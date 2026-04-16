import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Satellite, Brain, Cpu, Wifi, WifiOff, Database, Layers } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import InputForm from "@/components/InputForm1";
import ResultCard from "@/components/ResultCard";
import ReturnLossGraph from "@/components/ReturnLossGraph";
import InfoPanel from "@/components/InfoPanel";
import HistoryTable from "@/components/HistoryTable";
import AIAnalysisPanel from "@/components/AIAnalysisPanel";
import DatasetViewer from "@/components/DatasetViewer";

import {
  initializeModel,
  isReady as isMLReady,
  predict,
  getDatasetStats,
  getRawDataset,
} from "@/lib/mlModel";

interface HistoryEntry {
  vswr: number;
  reflection: number;
  result: string;
}

interface AIAnalysis {
  verdict: string;
  confidence: number;
  analysis: string;
  risk_level: string;
  recommendations: string;
  model_details?: {
    regression_models?: Record<string, number>;
    classification_models?: Record<string, string | number>;
    ensemble_s11?: number;
    ensemble_method?: string;
  };
}

export default function Index() {
  const [result, setResult] = useState("Waiting...");
  const [status, setStatus] = useState("");
  const [graphData, setGraphData] = useState<number[]>([]);
  const [lastInput, setLastInput] = useState<any>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mlModelLoaded, setMlModelLoaded] = useState(false);
  const [predictionSource, setPredictionSource] = useState<string>("");
  const [datasetStats, setDatasetStats] = useState<any>(null);

  // Initialize client-side ML model on mount
  useEffect(() => {
    const loadModel = async () => {
      const success = await initializeModel();
      setMlModelLoaded(success);
      if (success) {
        const stats = getDatasetStats();
        setDatasetStats(stats);
        toast.success(`ML Model loaded with ${stats?.totalSamples} training samples`);
      }
    };
    loadModel();
  }, []);

  // ML-powered prediction (tries Flask first, falls back to client-side)
  const analyzeData = async (input: {
    freq: number;
    length: number;
    width: number;
    slot_length: number;
    slot_width: number;
  }) => {
    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      const data = await predict(input);

      console.log("Prediction Result:", data);

      const isPure = data.result === "Pure";
      const nextResult = isPure ? "Pure ✅" : "Adulterated ❌";

      // Track source
      setPredictionSource(data.source);
      const sourceLabel =
        data.source === "flask-api"
          ? "Flask API (Ensemble: RF+SVR+GB+SVC)"
          : "Browser ML (KNN)";

      // RESULT
      setResult(nextResult);
      setStatus(isPure ? "good" : "bad");

      // GRAPH — accumulate S11 readings
      setGraphData((prev) => [...prev, data.S11]);

      // STORE INPUT
      setLastInput(input);

      // HISTORY
      setHistory((prev) => [
        {
          vswr: 0,
          reflection: data.S11,
          result: nextResult,
        },
        ...prev,
      ]);

      // Build detailed analysis text
      const riskLevel =
        data.S11 < -20
          ? "Low"
          : data.S11 < -10
            ? "Medium"
            : "High";

      // Generate analysis with model details
      const analysisLines: string[] = [
        `Predicted S11 (Ensemble): ${data.S11.toFixed(2)} dB`,
      ];

      // Add per-model breakdown if available from Flask API
      if (data.model_details?.regression_models) {
        const regModels = data.model_details.regression_models;
        const modelEntries = Object.entries(regModels);
        if (modelEntries.length > 0) {
          analysisLines.push(
            `Regression breakdown — ${modelEntries.map(([name, val]) => `${name}: ${val} dB`).join(", ")}`
          );
        }
      }

      if (data.model_details?.classification_models) {
        const clsModels = data.model_details.classification_models;
        const gbResult = clsModels["GradientBoosting"];
        const svcResult = clsModels["SVC"];
        const gbConf = clsModels["GradientBoosting_confidence"];
        const svcConf = clsModels["SVC_confidence"];
        
        if (gbResult && svcResult) {
          analysisLines.push(
            `Classification — GradientBoosting: ${gbResult} (${gbConf}%), SVC: ${svcResult} (${svcConf}%)`
          );
        }
      }

      analysisLines.push(`Model source: ${sourceLabel}`);
      analysisLines.push(`Ensemble confidence: ${data.confidence}%`);
      analysisLines.push(
        data.S11 < -10
          ? "The antenna return loss indicates good impedance matching, suggesting the food sample is uncontaminated"
          : "The antenna return loss suggests poor impedance matching, which may indicate adulteration in the food sample"
      );
      analysisLines.push(
        `Input — Freq: ${input.freq} GHz, Patch: ${input.length}×${input.width} mm, Slot: ${input.slot_length}×${input.slot_width} mm`
      );

      const analysisText = analysisLines.join(". ");

      const recommendations = data.S11 < -10
        ? "Antenna performance is within acceptable thresholds. The food sample shows expected dielectric properties consistent with a pure sample. All 4 models (RF, SVR, GB, SVC) were consulted for this ensemble prediction. Continue standard monitoring protocols."
        : "S11 value exceeds -10 dB threshold. Recommend re-testing with calibrated probe. The ensemble of 4 models flagged potential adulteration. If persistent, the food sample may contain adulterants that alter dielectric properties. Consider chemical verification.";

      setAiAnalysis({
        verdict: data.result,
        confidence: data.confidence,
        analysis: analysisText,
        risk_level: riskLevel,
        recommendations,
        model_details: data.model_details,
      });

      toast.success(`Prediction complete via ${sourceLabel}`);
    } catch (err) {
      console.error("Prediction Error:", err);
      toast.error("Prediction failed. Check console for details.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    setGraphData([]);
  };

  const downloadCsv = (rows: HistoryEntry[]) => {
    const csv = [
      ["VSWR", "Reflection", "Result"],
      ...rows.map((row) => [row.vswr, row.reflection, row.result]),
    ]
      .map((line) => line.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "antenna-history.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Satellite className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Antenna-Based Food Adulteration Detection
            </h1>
            <p className="text-xs text-muted-foreground">
              AI-powered non-invasive quality analysis using RF antenna parameters
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* ML Model Status Badge */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                    mlModelLoaded
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20"
                  }`}
                >
                  {mlModelLoaded ? (
                    <Wifi className="w-3.5 h-3.5" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5" />
                  )}
                  {mlModelLoaded ? "ML Ready" : "Loading ML..."}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {mlModelLoaded
                  ? `Client-side KNN model loaded with ${datasetStats?.totalSamples || 0} training samples`
                  : "ML model is loading..."}
              </TooltipContent>
            </Tooltip>

            {/* Prediction Source Badge */}
            {predictionSource && (
              <Badge
                variant="outline"
                className={
                  predictionSource === "flask-api"
                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                }
              >
                <Cpu className="w-3 h-3 mr-1" />
                {predictionSource === "flask-api" ? "Flask Ensemble" : "Browser ML"}
              </Badge>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Brain className="w-3.5 h-3.5" />
              AI Enhanced
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* DATASET STATS BANNER */}
        {datasetStats && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-primary/20 bg-primary/5 p-4"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <Database className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground">ML Ensemble Trained</span>
              <Badge variant="secondary" className="font-mono">
                {datasetStats.totalSamples} samples
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                S11 range: {datasetStats.targetRange.min.toFixed(1)} to{" "}
                {datasetStats.targetRange.max.toFixed(1)} dB
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                Freq: {datasetStats.featureRanges.freq.min}–{datasetStats.featureRanges.freq.max} GHz
              </Badge>
              <Badge variant="outline" className="font-mono text-xs bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                <Layers className="w-3 h-3 mr-1" />
                4 Models: RF + SVR + GB + SVC
              </Badge>
            </div>
          </motion.div>
        )}

        {/* MODEL DETAIL CARDS (after prediction) */}
        {aiAnalysis?.model_details?.regression_models && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Regression Model Breakdown */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Regression Models (S11 Prediction)
              </h4>
              <div className="space-y-2">
                {Object.entries(aiAnalysis.model_details.regression_models).map(([name, value]) => (
                  <div key={name} className="flex items-center justify-between rounded-md bg-background/70 border border-border/50 px-3 py-2">
                    <span className="text-sm font-medium text-muted-foreground">{name}</span>
                    <span className="text-sm font-bold font-mono text-foreground">{value} dB</span>
                  </div>
                ))}
                {aiAnalysis.model_details.ensemble_s11 !== undefined && (
                  <div className="flex items-center justify-between rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
                    <span className="text-sm font-semibold text-primary">Ensemble (Final)</span>
                    <span className="text-sm font-bold font-mono text-primary">{aiAnalysis.model_details.ensemble_s11} dB</span>
                  </div>
                )}
              </div>
              {aiAnalysis.model_details.ensemble_method && (
                <p className="text-xs text-muted-foreground mt-2">
                  Method: {aiAnalysis.model_details.ensemble_method}
                </p>
              )}
            </div>

            {/* Classification Model Breakdown */}
            {aiAnalysis.model_details.classification_models && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  Classification Models (Pure/Adulterated)
                </h4>
                <div className="space-y-2">
                  {(() => {
                    const models = aiAnalysis.model_details!.classification_models!;
                    const entries: Array<{ name: string; result: string; confidence?: number }> = [];
                    
                    if (models["GradientBoosting"]) {
                      entries.push({
                        name: "GradientBoosting",
                        result: String(models["GradientBoosting"]),
                        confidence: models["GradientBoosting_confidence"] as number | undefined,
                      });
                    }
                    if (models["SVC"]) {
                      entries.push({
                        name: "SVC (SVM)",
                        result: String(models["SVC"]),
                        confidence: models["SVC_confidence"] as number | undefined,
                      });
                    }

                    return entries.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between rounded-md bg-background/70 border border-border/50 px-3 py-2">
                        <span className="text-sm font-medium text-muted-foreground">{entry.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.result === "Pure" ? "secondary" : "destructive"} className="text-xs">
                            {entry.result}
                          </Badge>
                          {entry.confidence !== undefined && (
                            <span className="text-xs font-mono text-muted-foreground">{entry.confidence}%</span>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                  <div className="flex items-center justify-between rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
                    <span className="text-sm font-semibold text-primary">Ensemble (Final)</span>
                    <Badge variant={aiAnalysis.verdict === "Pure" ? "secondary" : "destructive"} className="text-xs">
                      {aiAnalysis.verdict}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* INPUT + RESULT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputForm onAnalyze={analyzeData} isAnalyzing={isAnalyzing} />
          <ResultCard result={result} status={status} />
        </div>

        {/* AI PANEL */}
        {(aiAnalysis || isAnalyzing) && (
          <AIAnalysisPanel analysis={aiAnalysis} isLoading={isAnalyzing} />
        )}

        {/* GRAPH */}
        <ReturnLossGraph graphData={graphData} />

        {/* DATASET VIEWER */}
        <DatasetViewer />

        {/* INFO + HISTORY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InfoPanel />
          <HistoryTable
            history={history}
            onClear={clearHistory}
            onDownload={downloadCsv}
          />
        </div>
      </main>
    </div>
  );
}