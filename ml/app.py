# ml/app.py
# Flask API for Antenna-Based Food Adulteration Detection
# Serves Ensemble predictions from 4 models:
#   Regression:      RandomForest + SVR
#   Classification:  GradientBoosting + SVC

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import json
import os

app = Flask(__name__)
CORS(app)

# =========================
# LOAD MODELS + SCALER
# =========================
script_dir = os.path.dirname(os.path.abspath(__file__))

reg_model = joblib.load(os.path.join(script_dir, "model.pkl"))
scaler = joblib.load(os.path.join(script_dir, "scaler.pkl"))

# Load SVR model
svr_model = None
svr_path = os.path.join(script_dir, "svr_model.pkl")
if os.path.exists(svr_path):
    svr_model = joblib.load(svr_path)
    print("SVR model loaded successfully")

# Load GradientBoosting classifier
cls_model = None
cls_path = os.path.join(script_dir, "classifier.pkl")
if os.path.exists(cls_path):
    cls_model = joblib.load(cls_path)
    print("GradientBoosting classifier loaded successfully")

# Load SVC classifier
svc_model = None
svc_path = os.path.join(script_dir, "svc_classifier.pkl")
if os.path.exists(svc_path):
    svc_model = joblib.load(svc_path)
    print("SVC classifier loaded successfully")

# Load metadata
metadata = None
meta_path = os.path.join(script_dir, "model_metadata.json")
if os.path.exists(meta_path):
    with open(meta_path, "r") as f:
        metadata = json.load(f)
    print("Model metadata loaded")

print("All models & scaler loaded successfully")

# =========================
# FEATURE ENGINEERING
# =========================
def engineer_features(freq, length, width, slot_length, slot_width):
    """Create the same engineered features used during training."""
    slot_area = slot_length * slot_width
    patch_area = length * width
    slot_ratio = slot_area / (patch_area + 1e-6)
    slot_perimeter = 2 * (slot_length + slot_width)
    freq_slot_interaction = freq * slot_area

    return np.array([[
        freq, length, width, slot_length, slot_width,
        slot_area, slot_ratio, slot_perimeter, freq_slot_interaction
    ]])

# =========================
# HOME ROUTE
# =========================
@app.route("/")
def home():
    models_info = {
        "regression": ["RandomForestRegressor"],
        "classification": [],
    }
    if svr_model:
        models_info["regression"].append("SVR (RBF)")
    if cls_model:
        models_info["classification"].append("GradientBoostingClassifier")
    if svc_model:
        models_info["classification"].append("SVC (RBF)")

    return jsonify({
        "status": "running",
        "message": "Antenna ML API is running (Ensemble: RF + SVR + GB + SVC)",
        "models": models_info,
        "metadata": metadata
    })

# =========================
# PREDICT ROUTE
# =========================
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json

        # INPUT: 5 antenna parameters
        freq = float(data["freq"])
        length = float(data["length"])
        width = float(data["width"])
        slot_length = float(data["slot_length"])
        slot_width = float(data["slot_width"])

        # Engineer features (same as training)
        input_features = engineer_features(freq, length, width, slot_length, slot_width)

        # Scale
        input_scaled = scaler.transform(input_features)

        # ---- REGRESSION (Ensemble: RF + SVR) ----
        rf_s11 = float(reg_model.predict(input_scaled)[0])
        
        regression_models = {"RandomForest": round(rf_s11, 2)}
        svr_s11 = None
        
        if svr_model is not None:
            svr_s11 = float(svr_model.predict(input_scaled)[0])
            regression_models["SVR"] = round(svr_s11, 2)
            # Ensemble: weighted average (RF gets slightly more weight)
            s11_prediction = 0.55 * rf_s11 + 0.45 * svr_s11
        else:
            s11_prediction = rf_s11

        # ---- CLASSIFICATION (Ensemble: GB + SVC) ----
        classification_models = {}
        gb_pred = None
        svc_pred = None
        gb_confidence = None
        svc_confidence = None

        if cls_model is not None:
            gb_pred = int(cls_model.predict(input_scaled)[0])
            classification_models["GradientBoosting"] = "Pure" if gb_pred == 1 else "Adulterated"
            if hasattr(cls_model, "predict_proba"):
                gb_proba = cls_model.predict_proba(input_scaled)[0]
                gb_confidence = round(float(max(gb_proba)) * 100, 1)
                classification_models["GradientBoosting_confidence"] = gb_confidence

        if svc_model is not None:
            svc_pred = int(svc_model.predict(input_scaled)[0])
            classification_models["SVC"] = "Pure" if svc_pred == 1 else "Adulterated"
            if hasattr(svc_model, "predict_proba"):
                svc_proba = svc_model.predict_proba(input_scaled)[0]
                svc_confidence = round(float(max(svc_proba)) * 100, 1)
                classification_models["SVC_confidence"] = svc_confidence

        # Ensemble classification result
        if gb_pred is not None and svc_pred is not None:
            # Both agree -> use that, otherwise use the one with higher confidence
            if gb_pred == svc_pred:
                final_cls = gb_pred
            else:
                # Use the model with higher confidence
                if (gb_confidence or 0) >= (svc_confidence or 0):
                    final_cls = gb_pred
                else:
                    final_cls = svc_pred
            classification = "Pure" if final_cls == 1 else "Adulterated"
        elif gb_pred is not None:
            classification = "Pure" if gb_pred == 1 else "Adulterated"
        elif svc_pred is not None:
            classification = "Pure" if svc_pred == 1 else "Adulterated"
        else:
            classification = "Pure" if s11_prediction < -10 else "Adulterated"

        # Ensemble confidence
        confidences = [c for c in [gb_confidence, svc_confidence] if c is not None]
        cls_confidence = round(sum(confidences) / len(confidences), 1) if confidences else 85

        # Risk level based on ensemble S11
        if s11_prediction < -20:
            risk_level = "Low"
        elif s11_prediction < -10:
            risk_level = "Medium"
        else:
            risk_level = "High"

        return jsonify({
            "S11": round(s11_prediction, 2),
            "result": classification,
            "confidence": cls_confidence,
            "risk_level": risk_level,
            "input": {
                "freq": freq,
                "length": length,
                "width": width,
                "slot_length": slot_length,
                "slot_width": slot_width
            },
            "model_details": {
                "regression_models": regression_models,
                "classification_models": classification_models,
                "ensemble_s11": round(s11_prediction, 2),
                "ensemble_method": "weighted_average (RF:0.55 + SVR:0.45)" if svr_model else "single_model",
            },
            "model_info": {
                "regression": "Ensemble (RandomForest + SVR)" if svr_model else "RandomForestRegressor",
                "classification": "Ensemble (GradientBoosting + SVC)" if (cls_model and svc_model) else "GradientBoostingClassifier",
                "scaling": "StandardScaler",
                "feature_engineering": "slot_area, slot_ratio, slot_perimeter, freq_slot_interaction"
            }
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

# =========================
# MODEL INFO ROUTE
# =========================
@app.route("/info", methods=["GET"])
def model_info():
    return jsonify(metadata if metadata else {"message": "No metadata available"})

# =========================
# RUN SERVER
# =========================
if __name__ == "__main__":
    app.run(debug=True, port=5000)