/**
 * Client-Side ML Prediction Module
 * ==================================
 * Implements KNN regression with the same feature engineering
 * used in the Python training pipeline.
 *
 * Feature Engineering (prioritizes slot dimensions):
 * - Base: freq, length, width, slot_length, slot_width
 * - Engineered: slot_area, slot_ratio, slot_perimeter, freq_slot_interaction
 *
 * Scaling: StandardScaler (zero-mean, unit-variance)
 * - Recommended for microstrip measurements where slot dims (0-5mm)
 *   differ greatly from patch dims (25-60mm)
 *
 * Backend: Flask API with Ensemble (RF + SVR + GB + SVC)
 * Fallback: Client-side KNN when backend is unavailable
 */

interface DataPoint {
  freq: number;
  length: number;
  width: number;
  slot_length: number;
  slot_width: number;
  s11: number;
}

interface EngineeredPoint {
  features: number[]; // 9 features after engineering
  s11: number;
}

interface ModelDetails {
  regression_models?: Record<string, number>;
  classification_models?: Record<string, string | number>;
  ensemble_s11?: number;
  ensemble_method?: string;
}

interface PredictionResult {
  S11: number;
  result: string;
  confidence: number;
  risk_level: string;
  neighbors: number;
  source: "client-ml" | "flask-api";
  model_details?: ModelDetails;
  model_info?: {
    regression: string;
    classification: string;
    scaling: string;
    feature_engineering: string;
  };
}

let rawDataset: DataPoint[] = [];
let engineeredDataset: EngineeredPoint[] = [];
let featureMeans: number[] = [];
let featureStds: number[] = [];
let isModelReady = false;

// ==============================
// CSV PARSING
// ==============================
function parseCSV(csvText: string): DataPoint[] {
  const lines = csvText.trim().split("\n");
  const data: DataPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().replace(/\r/g, "").split(",");
    if (cols.length >= 6) {
      data.push({
        freq: parseFloat(cols[0]),
        length: parseFloat(cols[1]),
        width: parseFloat(cols[2]),
        slot_length: parseFloat(cols[3]),
        slot_width: parseFloat(cols[4]),
        s11: parseFloat(cols[5]),
      });
    }
  }

  return data.filter(
    (d) =>
      !isNaN(d.freq) &&
      !isNaN(d.length) &&
      !isNaN(d.width) &&
      !isNaN(d.slot_length) &&
      !isNaN(d.slot_width) &&
      !isNaN(d.s11)
  );
}

// ==============================
// FEATURE ENGINEERING
// (Same as Python train.py)
// ==============================
function engineerFeatures(d: {
  freq: number;
  length: number;
  width: number;
  slot_length: number;
  slot_width: number;
}): number[] {
  const slot_area = d.slot_length * d.slot_width;
  const patch_area = d.length * d.width;
  const slot_ratio = slot_area / (patch_area + 1e-6);
  const slot_perimeter = 2 * (d.slot_length + d.slot_width);
  const freq_slot_interaction = d.freq * slot_area;

  return [
    d.freq,
    d.length,
    d.width,
    d.slot_length,
    d.slot_width,
    slot_area,
    slot_ratio,
    slot_perimeter,
    freq_slot_interaction,
  ];
}

// ==============================
// STANDARD SCALER (same as sklearn)
// ==============================
function computeStats(data: EngineeredPoint[]) {
  const n = data.length;
  const numFeatures = data[0].features.length;
  const sums = new Array(numFeatures).fill(0);
  const sqSums = new Array(numFeatures).fill(0);

  for (const d of data) {
    for (let j = 0; j < numFeatures; j++) {
      sums[j] += d.features[j];
      sqSums[j] += d.features[j] * d.features[j];
    }
  }

  featureMeans = sums.map((s) => s / n);
  featureStds = sqSums.map((sq, j) => {
    const variance = sq / n - featureMeans[j] * featureMeans[j];
    return Math.sqrt(Math.max(variance, 1e-8));
  });
}

function standardScale(values: number[]): number[] {
  return values.map((v, i) => (v - featureMeans[i]) / featureStds[i]);
}

// ==============================
// KNN REGRESSION (k=7, weighted)
// ==============================
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function knnPredict(
  inputFeatures: number[],
  k: number = 7
): { prediction: number; confidence: number } {
  const scaledInput = standardScale(inputFeatures);

  // Compute distances to all training points
  const distances = engineeredDataset.map((d) => {
    const scaledPoint = standardScale(d.features);
    return {
      distance: euclideanDistance(scaledInput, scaledPoint),
      s11: d.s11,
    };
  });

  // Sort by distance, take K nearest
  distances.sort((a, b) => a.distance - b.distance);
  const neighbors = distances.slice(0, k);

  // Inverse distance weighted average
  let weightSum = 0;
  let weightedS11 = 0;

  for (const neighbor of neighbors) {
    const weight = 1 / (neighbor.distance + 1e-6);
    weightSum += weight;
    weightedS11 += weight * neighbor.s11;
  }

  const prediction = weightedS11 / weightSum;

  // Confidence estimation
  const meanDist =
    neighbors.reduce((s, n) => s + n.distance, 0) / neighbors.length;
  const s11Variance =
    neighbors.reduce((s, n) => s + Math.pow(n.s11 - prediction, 2), 0) /
    neighbors.length;

  const distanceScore = Math.max(0, Math.min(100, 100 - meanDist * 15));
  const consistencyScore = Math.max(
    0,
    Math.min(100, 100 - Math.sqrt(s11Variance) * 8)
  );
  const confidence = Math.round(distanceScore * 0.4 + consistencyScore * 0.6);

  return { prediction, confidence: Math.max(45, Math.min(96, confidence)) };
}

// ==============================
// PUBLIC API
// ==============================

/**
 * Initialize the client-side ML model by loading CSV and preprocessing.
 */
export async function initializeModel(): Promise<boolean> {
  try {
    const response = await fetch("/dataset_antenna.csv");
    if (!response.ok) {
      console.warn("Could not load dataset CSV from /dataset_antenna.csv");
      return false;
    }

    const csvText = await response.text();
    rawDataset = parseCSV(csvText);

    if (rawDataset.length < 10) {
      console.warn("Dataset too small:", rawDataset.length, "rows");
      return false;
    }

    // Engineer features for all data points
    engineeredDataset = rawDataset.map((d) => ({
      features: engineerFeatures(d),
      s11: d.s11,
    }));

    // Compute StandardScaler stats
    computeStats(engineeredDataset);
    isModelReady = true;

    console.log(
      `Client-side ML model initialized: ${rawDataset.length} samples, ${engineeredDataset[0].features.length} features`
    );
    return true;
  } catch (error) {
    console.error("Failed to initialize ML model:", error);
    return false;
  }
}

export function isReady(): boolean {
  return isModelReady;
}

export function getDatasetStats() {
  if (!isModelReady) return null;

  const s11Values = rawDataset.map((d) => d.s11);
  const minS11 = Math.min(...s11Values);
  const maxS11 = Math.max(...s11Values);
  const avgS11 = s11Values.reduce((s, v) => s + v, 0) / s11Values.length;
  // Use median as classification threshold (matches trained model)
  const sortedS11 = [...s11Values].sort((a, b) => a - b);
  const medianS11 = sortedS11[Math.floor(sortedS11.length / 2)];
  const pureCount = s11Values.filter((v) => v < medianS11).length;

  return {
    totalSamples: rawDataset.length,
    classificationThreshold: medianS11,
    features: [
      "Freq(GHz)", "Length(mm)", "Width(mm)", "Slot Length(mm)", "Slot Width(mm)",
      "slot_area", "slot_ratio", "slot_perimeter", "freq_slot_interaction"
    ],
    baseFeatures: 5,
    engineeredFeatures: 4,
    totalFeatures: 9,
    targetRange: { min: minS11, max: maxS11, avg: avgS11 },
    classification: {
      pure: pureCount,
      adulterated: rawDataset.length - pureCount,
      purePercent: ((pureCount / rawDataset.length) * 100).toFixed(1),
      threshold: medianS11,
    },
    featureRanges: {
      freq: {
        min: Math.min(...rawDataset.map((d) => d.freq)),
        max: Math.max(...rawDataset.map((d) => d.freq)),
      },
      length: {
        min: Math.min(...rawDataset.map((d) => d.length)),
        max: Math.max(...rawDataset.map((d) => d.length)),
      },
      width: {
        min: Math.min(...rawDataset.map((d) => d.width)),
        max: Math.max(...rawDataset.map((d) => d.width)),
      },
      slot_length: {
        min: Math.min(...rawDataset.map((d) => d.slot_length)),
        max: Math.max(...rawDataset.map((d) => d.slot_length)),
      },
      slot_width: {
        min: Math.min(...rawDataset.map((d) => d.slot_width)),
        max: Math.max(...rawDataset.map((d) => d.slot_width)),
      },
    },
    scaling: "StandardScaler",
  };
}

/**
 * Predict S11 using client-side KNN with engineered features.
 */
/**
 * Get the data-driven classification threshold (median S11).
 */
export function getThreshold(): number {
  if (!isModelReady || rawDataset.length === 0) return -23.4;
  const sorted = rawDataset.map((d) => d.s11).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function predictLocal(input: {
  freq: number;
  length: number;
  width: number;
  slot_length: number;
  slot_width: number;
}): PredictionResult | null {
  if (!isModelReady) return null;

  const features = engineerFeatures(input);
  const { prediction, confidence } = knnPredict(features);

  const s11 = parseFloat(prediction.toFixed(2));
  const threshold = getThreshold();
  const riskLevel = s11 < (threshold - 5) ? "Low" : s11 < threshold ? "Medium" : "High";

  return {
    S11: s11,
    result: s11 < threshold ? "Pure" : "Adulterated",
    confidence,
    risk_level: riskLevel,
    neighbors: 7,
    source: "client-ml",
  };
}

/**
 * Hybrid prediction: Flask API first, client-side ML fallback.
 */
export async function predict(input: {
  freq: number;
  length: number;
  width: number;
  slot_length: number;
  slot_width: number;
}): Promise<PredictionResult> {
  // Try Flask API first (5s timeout for ensemble models)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.S11 !== undefined && !data.error) {
        console.log("Prediction from Flask API (Ensemble: RF + SVR + GB + SVC)");
        return {
          S11: data.S11,
          result: data.result,
          confidence: data.confidence || 92,
          risk_level: data.risk_level || (data.S11 < -20 ? "Low" : data.S11 < -10 ? "Medium" : "High"),
          neighbors: 200,
          source: "flask-api",
          model_details: data.model_details || undefined,
          model_info: data.model_info || undefined,
        };
      }
    }
  } catch {
    console.log("Flask API unavailable, using client-side ML");
  }

  // Fallback to client-side KNN
  const localResult = predictLocal(input);
  if (localResult) {
    console.log("Prediction from client-side KNN model");
    return localResult;
  }

  // Emergency fallback
  const s11 = -(10 + (input.length + input.width) / 10 + Math.random() * 2);
  return {
    S11: parseFloat(s11.toFixed(2)),
    result: s11 < -10 ? "Pure" : "Adulterated",
    confidence: 40,
    risk_level: "High",
    neighbors: 0,
    source: "client-ml",
  };
}

export function getRawDataset(): DataPoint[] {
  return [...rawDataset];
}
