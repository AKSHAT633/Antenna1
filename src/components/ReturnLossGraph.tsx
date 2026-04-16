import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from "recharts";
import { Activity } from "lucide-react";

interface ReturnLossGraphProps {
  graphData: number[];
  labels?: string[];
}

function ReturnLossGraph({ graphData, labels }: ReturnLossGraphProps) {
  const chartData = useMemo(() => {
    const safeData = Array.isArray(graphData) && graphData.length ? graphData : [0, 0, 0, 0, 0, 0];
    return safeData.map((value, i) => ({
      frequency: labels?.[i] ?? `${i + 1} GHz`,
      returnLoss: value,
    }));
  }, [graphData, labels]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="glass-card rounded-lg p-6"
    >
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-primary" />
        Return Loss Chart
      </h3>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorRL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 88%)" />
            <XAxis
              dataKey="frequency"
              tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }}
              label={{ value: "Frequency", position: "insideBottom", offset: -2, style: { fontSize: 12, fill: "hsl(220, 10%, 46%)" } }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }}
              label={{ value: "Return Loss (dB)", angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "hsl(220, 10%, 46%)" } }}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(220, 13%, 88%)",
                borderRadius: "8px",
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
              }}
              formatter={(value: number) => [`${value} dB`, "Return Loss"]}
            />
            <Area
              type="monotone"
              dataKey="returnLoss"
              stroke="hsl(160, 84%, 39%)"
              strokeWidth={2.5}
              fill="url(#colorRL)"
              dot={{ r: 4, fill: "hsl(0, 0%, 100%)", stroke: "hsl(160, 84%, 39%)", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

export default ReturnLossGraph;
