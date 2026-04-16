import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, RotateCcw, FlaskConical } from "lucide-react";

interface InputFormProps {
  onAnalyze: (input: {
    freq: number;
    length: number;
    width: number;
    slot_length: number;
    slot_width: number;
  }) => void;
  isAnalyzing?: boolean;
}

function InputForm({ onAnalyze, isAnalyzing }: InputFormProps) {
  const [freq, setFreq] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [slotLength, setSlotLength] = useState("");
  const [slotWidth, setSlotWidth] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const freqValue = parseFloat(freq);
    const lengthValue = parseFloat(length);
    const widthValue = parseFloat(width);
    const slotLengthValue = parseFloat(slotLength);
    const slotWidthValue = parseFloat(slotWidth);

    if (
      !Number.isFinite(freqValue) ||
      !Number.isFinite(lengthValue) ||
      !Number.isFinite(widthValue) ||
      !Number.isFinite(slotLengthValue) ||
      !Number.isFinite(slotWidthValue)
    ) {
      setError("Please enter valid numeric values.");
      return;
    }

    onAnalyze({
      freq: freqValue,
      length: lengthValue,
      width: widthValue,
      slot_length: slotLengthValue,
      slot_width: slotWidthValue,
    });
  };

  const handleReset = () => {
    setFreq("");
    setLength("");
    setWidth("");
    setSlotLength("");
    setSlotWidth("");
    setError("");
  };

  const simulate = () => {
    const simulatedData = {
      freq: parseFloat((2.4 + Math.random() * 2).toFixed(2)),
      length: Math.floor(30 + Math.random() * 20),
      width: Math.floor(25 + Math.random() * 20),
      slot_length: Math.floor(Math.random() * 5),
      slot_width: Math.floor(Math.random() * 5),
    };

    onAnalyze(simulatedData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-lg p-6 space-y-5"
    >
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-primary" />
        Antenna Parameters
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="space-y-2">
          <Label>Frequency (GHz)</Label>
          <Input
            type="number"
            value={freq}
            onChange={(e) => setFreq(e.target.value)}
            placeholder="e.g. 2.4"
          />
        </div>

        <div className="space-y-2">
          <Label>Patch Length (mm)</Label>
          <Input
            type="number"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            placeholder="e.g. 33"
          />
        </div>

        <div className="space-y-2">
          <Label>Patch Width (mm)</Label>
          <Input
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder="e.g. 29"
          />
        </div>

        <div className="space-y-2">
          <Label>Slot Length (mm)</Label>
          <Input
            type="number"
            value={slotLength}
            onChange={(e) => setSlotLength(e.target.value)}
            placeholder="e.g. 0"
          />
        </div>

        <div className="space-y-2">
          <Label>Slot Width (mm)</Label>
          <Input
            type="number"
            value={slotWidth}
            onChange={(e) => setSlotWidth(e.target.value)}
            placeholder="e.g. 0"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive font-medium">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" className="flex-1 gap-2" disabled={isAnalyzing}>
            <Zap className="w-4 h-4" />
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Button>

          <Button type="button" variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </form>

      <Button type="button" variant="secondary" className="w-full" onClick={simulate}>
        🎲 Simulate Random Data
      </Button>
    </motion.div>
  );
}

export default InputForm;