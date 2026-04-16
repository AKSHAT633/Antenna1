import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

interface ResultCardProps {
  result: string;
  status: string;
  vswr?: number;
  reflection?: number;
}

function ResultCard({ result, status, vswr, reflection }: ResultCardProps) {
  const isGood = status === "good";
  const isWaiting = !status;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`glass-card rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-4 ${
        isGood ? "border-success/30" : status === "bad" ? "border-destructive/30" : ""
      }`}
    >
      <h3 className="text-lg font-semibold text-foreground">Detection Result</h3>

      <AnimatePresence mode="wait">
        <motion.div
          key={result}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="flex flex-col items-center gap-3"
        >
          {isWaiting ? (
            <Clock className="w-12 h-12 text-muted-foreground" />
          ) : isGood ? (
            <CheckCircle2 className="w-12 h-12 text-success" />
          ) : (
            <XCircle className="w-12 h-12 text-destructive" />
          )}
          <span className={`text-2xl font-bold font-mono ${
            isWaiting ? "text-muted-foreground" : isGood ? "text-success" : "text-destructive"
          }`}>
            {result}
          </span>
        </motion.div>
      </AnimatePresence>

      {vswr !== undefined && reflection !== undefined && (
        <div className="grid grid-cols-2 gap-4 w-full mt-2">
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">VSWR</p>
            <p className="text-lg font-mono font-semibold text-foreground">{vswr}</p>
          </div>
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">Reflection</p>
            <p className="text-lg font-mono font-semibold text-foreground">{reflection} dB</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default ResultCard;
