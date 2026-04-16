import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { History as HistoryIcon, Download, Trash2 } from "lucide-react";

interface HistoryEntry {
  vswr: number;
  reflection: number;
  result: string;
}

interface HistoryTableProps {
  history: HistoryEntry[];
  onClear: () => void;
  onDownload: (rows: HistoryEntry[]) => void;
}

function HistoryTable({ history, onClear, onDownload }: HistoryTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="glass-card rounded-lg p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <HistoryIcon className="w-5 h-5 text-accent" />
          History
          {history.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
              {history.length}
            </span>
          )}
        </h3>
        {history.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onDownload(history)} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={onClear} className="gap-1.5 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </Button>
          </div>
        )}
      </div>

      {history.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">VSWR</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Reflection</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Result</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-mono">{h.vswr}</td>
                  <td className="px-4 py-2.5 font-mono">{h.reflection} dB</td>
                  <td className="px-4 py-2.5 font-semibold">
                    <span className={h.result.includes("Pure") ? "text-success" : "text-destructive"}>
                      {h.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No analysis history yet. Run an analysis to see results here.
        </div>
      )}
    </motion.div>
  );
}

export default HistoryTable;
