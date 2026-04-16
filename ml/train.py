"""
RF Antenna ML Training Pipeline
================================
Trains both Regression (S11 prediction) and Classification (Pure/Adulterated)
models from the antenna dataset.

Models:
  Regression:      RandomForestRegressor + SVR (Support Vector Regression)
  Classification:  GradientBoostingClassifier + SVC (Support Vector Classifier)

Feature Engineering:
- Prioritizes slot dimensions (slot_length, slot_width) since they are
  most sensitive to dielectric changes of the MUT (Material Under Test).
- Creates interaction features: slot_area, slot_ratio, slot_perimeter

Scaling: StandardScaler (recommended for microstrip measurements)
- Slot dims (0-5mm) vs patch dims (25-60mm) have very different magnitudes
- StandardScaler normalizes to zero-mean/unit-variance, preserving the
  relative sensitivity of each feature

Classification Threshold:
- Uses median S11 as the boundary between Pure and Adulterated.
- In real deployments, calibrate against known reference samples.
- S11 below median -> "Pure" (strong return loss = clean dielectric)
- S11 above median -> "Adulterated" (weaker match = altered dielectric)
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingClassifier
from sklearn.svm import SVR, SVC
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    mean_absolute_error, r2_score, mean_squared_error,
    accuracy_score, classification_report
)
import joblib
import os
import json

# ============================================================
# 1. LOAD DATASET
# ============================================================
script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, "dataset_antenna.csv")

df = pd.read_csv(csv_path)
df.columns = df.columns.str.strip()

print("=" * 60)
print("  RF ANTENNA ML TRAINING PIPELINE")
print("=" * 60)
print(f"\n[DATA] Loaded {df.shape[0]} rows, {df.shape[1]} columns")
print(f"[DATA] Columns: {list(df.columns)}")
print(f"[DATA] S11 range: {df['s11(dB)'].min():.2f} to {df['s11(dB)'].max():.2f} dB")
print(f"[DATA] S11 mean: {df['s11(dB)'].mean():.2f} dB, median: {df['s11(dB)'].median():.2f} dB")

# ============================================================
# 2. FEATURE ENGINEERING (Prioritize Slot Dimensions)
# ============================================================
base_features = [
    "Freq(GHz)",
    "length of patch in mm",
    "width of patch in mm",
    "Slot length in mm",
    "slot width in mm"
]

# Engineer slot-focused features to amplify their importance
df["slot_area"] = df["Slot length in mm"] * df["slot width in mm"]
df["patch_area"] = df["length of patch in mm"] * df["width of patch in mm"]
df["slot_ratio"] = df["slot_area"] / (df["patch_area"] + 1e-6)
df["slot_perimeter"] = 2 * (df["Slot length in mm"] + df["slot width in mm"])
df["freq_slot_interaction"] = df["Freq(GHz)"] * df["slot_area"]

feature_cols = base_features + [
    "slot_area",
    "slot_ratio",
    "slot_perimeter",
    "freq_slot_interaction"
]

print(f"\n[FEATURES] Base: {len(base_features)}, Engineered: {len(feature_cols) - len(base_features)}, Total: {len(feature_cols)}")
print(f"[FEATURES] Engineered: slot_area, slot_ratio, slot_perimeter, freq_slot_interaction")

# ============================================================
# 3. CLASSIFICATION THRESHOLD (data-driven)
# ============================================================
# Use median S11 as threshold since ALL values are < -10 dB
# In RF food testing: stronger return loss (more negative) = purer sample
s11_median = df["s11(dB)"].median()
THRESHOLD = round(float(s11_median), 1)

print(f"\n[THRESHOLD] Classification boundary: {THRESHOLD} dB (dataset median)")
print(f"  S11 < {THRESHOLD} dB  ->  'Pure' (strong return loss, clean dielectric)")
print(f"  S11 >= {THRESHOLD} dB ->  'Adulterated' (weaker match, altered dielectric)")

# ============================================================
# 4. PREPARE DATA
# ============================================================
X = df[feature_cols].copy()
y_regression = df["s11(dB)"]

# Classification: below median = Pure (1), above median = Adulterated (0)
y_classification = (df["s11(dB)"] < THRESHOLD).astype(int)

pure_count = int(y_classification.sum())
adult_count = int((1 - y_classification).sum())
print(f"\n[LABELS] Pure: {pure_count} ({pure_count/len(df)*100:.1f}%), Adulterated: {adult_count} ({adult_count/len(df)*100:.1f}%)")

# ============================================================
# 5. SCALING (StandardScaler)
# ============================================================
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

print(f"\n[SCALING] StandardScaler applied")
print(f"  Feature means (base): {np.round(scaler.mean_[:5], 2)}")
print(f"  Feature stds  (base): {np.round(scaler.scale_[:5], 2)}")

# ============================================================
# 6. TRAIN/TEST SPLIT
# ============================================================
X_train, X_test, y_reg_train, y_reg_test, y_cls_train, y_cls_test = train_test_split(
    X_scaled, y_regression, y_classification, test_size=0.2, random_state=42, stratify=y_classification
)

print(f"\n[SPLIT] Train: {X_train.shape[0]}, Test: {X_test.shape[0]} (stratified)")

# ============================================================
# 7a. REGRESSION MODEL — RandomForest
# ============================================================
print("\n" + "=" * 60)
print("  REGRESSION MODEL 1: RandomForest")
print("=" * 60)

reg_model = RandomForestRegressor(
    n_estimators=200,
    max_depth=15,
    min_samples_split=5,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1
)
reg_model.fit(X_train, y_reg_train)

y_reg_pred = reg_model.predict(X_test)
reg_mae = mean_absolute_error(y_reg_test, y_reg_pred)
reg_rmse = np.sqrt(mean_squared_error(y_reg_test, y_reg_pred))
reg_r2 = r2_score(y_reg_test, y_reg_pred)
cv_scores = cross_val_score(reg_model, X_scaled, y_regression, cv=5, scoring="r2")

print(f"\n  MAE:   {reg_mae:.4f} dB")
print(f"  RMSE:  {reg_rmse:.4f} dB")
print(f"  R2:    {reg_r2:.4f}")
print(f"  CV R2: {cv_scores.mean():.4f} (+/- {cv_scores.std()*2:.4f})")

# Feature importance
feature_importance = dict(zip(feature_cols, reg_model.feature_importances_))
sorted_importance = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)

print(f"\n  Feature Importance (Regression - RF):")
for feat, imp in sorted_importance:
    bar = "#" * int(imp * 80)
    marker = " << SLOT" if "slot" in feat.lower() or "Slot" in feat else ""
    print(f"    {feat:30s} {imp:.4f} {bar}{marker}")

# Calculate slot feature total importance
slot_importance = sum(v for k, v in feature_importance.items() if "slot" in k.lower() or "Slot" in k)
print(f"\n  >> Total SLOT feature importance: {slot_importance:.4f} ({slot_importance*100:.1f}%)")

# ============================================================
# 7b. REGRESSION MODEL — SVR (Support Vector Regression)
# ============================================================
print("\n" + "=" * 60)
print("  REGRESSION MODEL 2: SVR (Support Vector Regression)")
print("=" * 60)

svr_model = SVR(
    kernel='rbf',
    C=100.0,
    epsilon=0.1,
    gamma='scale'
)
svr_model.fit(X_train, y_reg_train)

y_svr_pred = svr_model.predict(X_test)
svr_mae = mean_absolute_error(y_reg_test, y_svr_pred)
svr_rmse = np.sqrt(mean_squared_error(y_reg_test, y_svr_pred))
svr_r2 = r2_score(y_reg_test, y_svr_pred)
svr_cv_scores = cross_val_score(svr_model, X_scaled, y_regression, cv=5, scoring="r2")

print(f"\n  MAE:   {svr_mae:.4f} dB")
print(f"  RMSE:  {svr_rmse:.4f} dB")
print(f"  R2:    {svr_r2:.4f}")
print(f"  CV R2: {svr_cv_scores.mean():.4f} (+/- {svr_cv_scores.std()*2:.4f})")

# Compare regression models
print(f"\n  --- Regression Model Comparison ---")
print(f"  {'Metric':<15} {'RandomForest':>15} {'SVR':>15} {'Better':>15}")
print(f"  {'-'*60}")
print(f"  {'MAE':<15} {reg_mae:>15.4f} {svr_mae:>15.4f} {'RF' if reg_mae < svr_mae else 'SVR':>15}")
print(f"  {'RMSE':<15} {reg_rmse:>15.4f} {svr_rmse:>15.4f} {'RF' if reg_rmse < svr_rmse else 'SVR':>15}")
print(f"  {'R2':<15} {reg_r2:>15.4f} {svr_r2:>15.4f} {'RF' if reg_r2 > svr_r2 else 'SVR':>15}")
print(f"  {'CV R2':<15} {cv_scores.mean():>15.4f} {svr_cv_scores.mean():>15.4f} {'RF' if cv_scores.mean() > svr_cv_scores.mean() else 'SVR':>15}")

# ============================================================
# 8a. CLASSIFICATION MODEL — GradientBoosting
# ============================================================
print("\n" + "=" * 60)
print("  CLASSIFICATION MODEL 1: GradientBoosting")
print("=" * 60)

cls_model = GradientBoostingClassifier(
    n_estimators=150,
    max_depth=5,
    learning_rate=0.1,
    min_samples_split=5,
    random_state=42
)
cls_model.fit(X_train, y_cls_train)

y_cls_pred = cls_model.predict(X_test)
cls_accuracy = accuracy_score(y_cls_test, y_cls_pred)
cv_cls_scores = cross_val_score(cls_model, X_scaled, y_classification, cv=5, scoring="accuracy")

print(f"\n  Accuracy:    {cls_accuracy:.4f} ({cls_accuracy*100:.1f}%)")
print(f"  CV Accuracy: {cv_cls_scores.mean():.4f} (+/- {cv_cls_scores.std()*2:.4f})")
print(f"\n  Classification Report (GradientBoosting):")
print(classification_report(y_cls_test, y_cls_pred, target_names=["Adulterated", "Pure"]))

# Classification feature importance
cls_fi = dict(zip(feature_cols, cls_model.feature_importances_))
sorted_cls_fi = sorted(cls_fi.items(), key=lambda x: x[1], reverse=True)

print(f"  Feature Importance (Classification - GB):")
for feat, imp in sorted_cls_fi:
    bar = "#" * int(imp * 80)
    marker = " << SLOT" if "slot" in feat.lower() or "Slot" in feat else ""
    print(f"    {feat:30s} {imp:.4f} {bar}{marker}")

cls_slot_importance = sum(v for k, v in cls_fi.items() if "slot" in k.lower() or "Slot" in k)
print(f"\n  >> Total SLOT feature importance: {cls_slot_importance:.4f} ({cls_slot_importance*100:.1f}%)")

# ============================================================
# 8b. CLASSIFICATION MODEL — SVC (Support Vector Classifier)
# ============================================================
print("\n" + "=" * 60)
print("  CLASSIFICATION MODEL 2: SVC (Support Vector Classifier)")
print("=" * 60)

svc_model = SVC(
    kernel='rbf',
    C=10.0,
    gamma='scale',
    probability=True,
    random_state=42
)
svc_model.fit(X_train, y_cls_train)

y_svc_pred = svc_model.predict(X_test)
svc_accuracy = accuracy_score(y_cls_test, y_svc_pred)
svc_cv_scores = cross_val_score(svc_model, X_scaled, y_classification, cv=5, scoring="accuracy")

print(f"\n  Accuracy:    {svc_accuracy:.4f} ({svc_accuracy*100:.1f}%)")
print(f"  CV Accuracy: {svc_cv_scores.mean():.4f} (+/- {svc_cv_scores.std()*2:.4f})")
print(f"\n  Classification Report (SVC):")
print(classification_report(y_cls_test, y_svc_pred, target_names=["Adulterated", "Pure"]))

# Compare classification models
print(f"\n  --- Classification Model Comparison ---")
print(f"  {'Metric':<15} {'GradientBoost':>15} {'SVC':>15} {'Better':>15}")
print(f"  {'-'*60}")
print(f"  {'Accuracy':<15} {cls_accuracy:>15.4f} {svc_accuracy:>15.4f} {'GB' if cls_accuracy > svc_accuracy else 'SVC':>15}")
print(f"  {'CV Accuracy':<15} {cv_cls_scores.mean():>15.4f} {svc_cv_scores.mean():>15.4f} {'GB' if cv_cls_scores.mean() > svc_cv_scores.mean() else 'SVC':>15}")

# ============================================================
# 9. SAVE ALL MODELS
# ============================================================
print("\n" + "=" * 60)
print("  SAVING MODELS")
print("=" * 60)

# Save all 4 models + scaler
joblib.dump(reg_model, os.path.join(script_dir, "model.pkl"))
joblib.dump(svr_model, os.path.join(script_dir, "svr_model.pkl"))
joblib.dump(cls_model, os.path.join(script_dir, "classifier.pkl"))
joblib.dump(svc_model, os.path.join(script_dir, "svc_classifier.pkl"))
joblib.dump(scaler, os.path.join(script_dir, "scaler.pkl"))

metadata = {
    "feature_columns": feature_cols,
    "base_features": base_features,
    "engineered_features": [f for f in feature_cols if f not in base_features],
    "scaling": "StandardScaler",
    "classification_threshold": THRESHOLD,
    "regression": {
        "random_forest": {
            "model": "RandomForestRegressor",
            "n_estimators": 200,
            "mae": round(reg_mae, 4),
            "rmse": round(reg_rmse, 4),
            "r2": round(reg_r2, 4),
            "cv_r2_mean": round(float(cv_scores.mean()), 4),
        },
        "svr": {
            "model": "SVR (RBF kernel)",
            "C": 100.0,
            "epsilon": 0.1,
            "mae": round(svr_mae, 4),
            "rmse": round(svr_rmse, 4),
            "r2": round(svr_r2, 4),
            "cv_r2_mean": round(float(svr_cv_scores.mean()), 4),
        },
        "best_model": "RandomForest" if reg_r2 > svr_r2 else "SVR",
    },
    "classification": {
        "gradient_boosting": {
            "model": "GradientBoostingClassifier",
            "n_estimators": 150,
            "accuracy": round(cls_accuracy, 4),
            "cv_accuracy_mean": round(float(cv_cls_scores.mean()), 4),
        },
        "svc": {
            "model": "SVC (RBF kernel)",
            "C": 10.0,
            "accuracy": round(svc_accuracy, 4),
            "cv_accuracy_mean": round(float(svc_cv_scores.mean()), 4),
        },
        "best_model": "GradientBoosting" if cls_accuracy > svc_accuracy else "SVC",
        "labels": {"0": "Adulterated", "1": "Pure"},
        "threshold": THRESHOLD,
    },
    "feature_importance_regression": {k: round(v, 4) for k, v in sorted_importance},
    "feature_importance_classification": {k: round(v, 4) for k, v in sorted_cls_fi},
    "slot_importance": {
        "regression_total": round(slot_importance, 4),
        "classification_total": round(cls_slot_importance, 4),
    },
    "dataset": {
        "total_samples": int(df.shape[0]),
        "s11_min": round(float(df["s11(dB)"].min()), 2),
        "s11_max": round(float(df["s11(dB)"].max()), 2),
        "s11_mean": round(float(df["s11(dB)"].mean()), 2),
        "s11_median": round(float(df["s11(dB)"].median()), 2),
    }
}

with open(os.path.join(script_dir, "model_metadata.json"), "w") as f:
    json.dump(metadata, f, indent=2)

print(f"\n  Saved: model.pkl          (RandomForest Regression)")
print(f"  Saved: svr_model.pkl      (SVR Regression)")
print(f"  Saved: classifier.pkl     (GradientBoosting Classification)")
print(f"  Saved: svc_classifier.pkl (SVC Classification)")
print(f"  Saved: scaler.pkl         (StandardScaler)")
print(f"  Saved: model_metadata.json")
print(f"\n{'=' * 60}")
print(f"  TRAINING COMPLETE — 4 Models Saved")
print(f"{'=' * 60}")