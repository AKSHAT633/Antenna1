import joblib
import numpy as np

print("Model loading...")

# Load model
model = joblib.load("svr_model.pkl")

print("Model loaded successfully!")

# Take input
freq = float(input("Enter frequency (GHz): "))
s11 = float(input("Enter S11 (dB): "))

# Prepare data
data = np.array([[freq, s11]])

# Predict
prediction = model.predict(data)

# Output
print(f"Predicted Adulteration: {prediction[0]:.2f}%")