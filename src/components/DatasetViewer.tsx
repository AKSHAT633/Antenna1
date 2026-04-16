import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Database,
  Table2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getRawDataset, getDatasetStats } from "@/lib/mlModel";

interface DataPoint {
  freq: number;
  length: number;
  width: number;
  slot_length: number;
  slot_width: number;
  s11: number;
}

function DatasetViewer() {
  const [dataset, setDataset] = useState<DataPoint[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleRows, setVisibleRows] = useState(20);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const data = getRawDataset();
    setDataset(data);
    setStats(getDatasetStats());
  }, []);

  const scatterData = useMemo(
    () =>
      dataset.map((d) => ({
        freq: d.freq,
        s11: d.s11,
        length: d.length,
        width: d.width,
        fill: d.s11 < -10 ? "hsl(160, 84%, 39%)" : "hsl(0, 84%, 60%)",
      })),
    [dataset]
  );

  const lengthVsS11 = useMemo(
    () =>
      dataset.map((d) => ({
        length: d.length,
        s11: d.s11,
        fill: d.s11 < -10 ? "hsl(160, 84%, 39%)" : "hsl(0, 84%, 60%)",
      })),
    [dataset]
  );

  if (dataset.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="glass-card rounded-lg p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          Training Dataset
          <Badge variant="secondary" className="font-mono text-xs">
            {dataset.length} rows
          </Badge>
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          {isExpanded ? "Collapse" : "Explore"}
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <Tabs defaultValue="chart" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chart" className="gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Scatter Plot
              </TabsTrigger>
              <TabsTrigger value="length" className="gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Length vs S11
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5">
                <Table2 className="w-3.5 h-3.5" />
                Raw Data
              </TabsTrigger>
            </TabsList>

            {/* SCATTER: Freq vs S11 */}
            <TabsContent value="chart">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(220, 13%, 88%)"
                    />
                    <XAxis
                      type="number"
                      dataKey="freq"
                      name="Frequency"
                      unit=" GHz"
                      tick={{
                        fontSize: 11,
                        fill: "hsl(220, 10%, 46%)",
                      }}
                      label={{
                        value: "Frequency (GHz)",
                        position: "insideBottom",
                        offset: -10,
                        style: {
                          fontSize: 12,
                          fill: "hsl(220, 10%, 46%)",
                        },
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="s11"
                      name="S11"
                      unit=" dB"
                      tick={{
                        fontSize: 11,
                        fill: "hsl(220, 10%, 46%)",
                      }}
                      label={{
                        value: "S11 (dB)",
                        angle: -90,
                        position: "insideLeft",
                        style: {
                          fontSize: 12,
                          fill: "hsl(220, 10%, 46%)",
                        },
                      }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{
                        background: "hsl(0, 0%, 100%)",
                        border: "1px solid hsl(220, 13%, 88%)",
                        borderRadius: "8px",
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(2)}`,
                        name,
                      ]}
                    />
                    <Scatter data={scatterData} fillOpacity={0.7}>
                      {scatterData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 justify-center mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[hsl(160,84%,39%)]" />
                  S11 &lt; -10 dB (Pure)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[hsl(0,84%,60%)]" />
                  S11 ≥ -10 dB (Adulterated)
                </span>
              </div>
            </TabsContent>

            {/* SCATTER: Length vs S11 */}
            <TabsContent value="length">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(220, 13%, 88%)"
                    />
                    <XAxis
                      type="number"
                      dataKey="length"
                      name="Patch Length"
                      unit=" mm"
                      tick={{
                        fontSize: 11,
                        fill: "hsl(220, 10%, 46%)",
                      }}
                      label={{
                        value: "Patch Length (mm)",
                        position: "insideBottom",
                        offset: -10,
                        style: {
                          fontSize: 12,
                          fill: "hsl(220, 10%, 46%)",
                        },
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="s11"
                      name="S11"
                      unit=" dB"
                      tick={{
                        fontSize: 11,
                        fill: "hsl(220, 10%, 46%)",
                      }}
                      label={{
                        value: "S11 (dB)",
                        angle: -90,
                        position: "insideLeft",
                        style: {
                          fontSize: 12,
                          fill: "hsl(220, 10%, 46%)",
                        },
                      }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{
                        background: "hsl(0, 0%, 100%)",
                        border: "1px solid hsl(220, 13%, 88%)",
                        borderRadius: "8px",
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    />
                    <Scatter data={lengthVsS11} fillOpacity={0.7}>
                      {lengthVsS11.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 justify-center mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[hsl(160,84%,39%)]" />
                  S11 &lt; -10 dB (Pure)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[hsl(0,84%,60%)]" />
                  S11 ≥ -10 dB (Adulterated)
                </span>
              </div>
            </TabsContent>

            {/* RAW DATA TABLE */}
            <TabsContent value="table">
              <div className="overflow-x-auto rounded-md border border-border max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                        #
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                        Freq (GHz)
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                        Length (mm)
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                        Width (mm)
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                        Slot L (mm)
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                        Slot W (mm)
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                        S11 (dB)
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.slice(0, visibleRows).map((d, i) => (
                      <tr
                        key={i}
                        className="border-t border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-3 py-2 font-mono text-muted-foreground text-xs">
                          {i + 1}
                        </td>
                        <td className="px-3 py-2 font-mono">{d.freq}</td>
                        <td className="px-3 py-2 font-mono">{d.length}</td>
                        <td className="px-3 py-2 font-mono">{d.width}</td>
                        <td className="px-3 py-2 font-mono">{d.slot_length}</td>
                        <td className="px-3 py-2 font-mono">{d.slot_width}</td>
                        <td className="px-3 py-2 font-mono font-semibold">
                          {d.s11}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={d.s11 < -10 ? "secondary" : "destructive"}
                            className="text-xs"
                          >
                            {d.s11 < -10 ? "Pure" : "Adultr."}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleRows < dataset.length && (
                <div className="flex justify-center mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setVisibleRows((prev) =>
                        Math.min(prev + 50, dataset.length)
                      )
                    }
                  >
                    Show more ({Math.min(50, dataset.length - visibleRows)}{" "}
                    remaining)
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* STATS GRID */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Samples</p>
                <p className="text-lg font-bold font-mono text-foreground">
                  {stats.totalSamples}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Min S11</p>
                <p className="text-lg font-bold font-mono text-success">
                  {stats.targetRange.min.toFixed(1)} dB
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Max S11</p>
                <p className="text-lg font-bold font-mono text-destructive">
                  {stats.targetRange.max.toFixed(1)} dB
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Avg S11</p>
                <p className="text-lg font-bold font-mono text-foreground">
                  {stats.targetRange.avg.toFixed(1)} dB
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Features</p>
                <p className="text-lg font-bold font-mono text-primary">5</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export default DatasetViewer;
