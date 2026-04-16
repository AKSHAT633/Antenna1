import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Copy,
  CheckCheck,
  Gauge,
  ListChecks,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AIAnalysis {
  verdict: string;
  confidence: number;
  analysis: string;
  risk_level: string;
  recommendations: string;
}

interface AIAnalysisPanelProps {
  analysis: AIAnalysis | null;
  isLoading: boolean;
}

function AIAnalysisPanel({ analysis, isLoading }: AIAnalysisPanelProps) {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-lg p-6"
      >
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">AI Analysis in Progress</h3>
            <p className="text-sm text-muted-foreground">Analyzing antenna parameters with AI model...</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 bg-muted rounded-full animate-pulse" />
          <div className="h-3 bg-muted rounded-full animate-pulse w-3/4" />
        </div>
      </motion.div>
    );
  }

  if (!analysis) return null;

  const isPure = analysis.verdict === "Pure";
  const normalizedConfidence = Math.max(0, Math.min(100, analysis.confidence));
  const riskColors: Record<string, string> = {
    Low: "text-success",
    Medium: "text-yellow-500",
    High: "text-destructive",
  };
  const riskAccent: Record<string, string> = {
    Low: "border-success/30 bg-success/10 text-success",
    Medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
    High: "border-destructive/30 bg-destructive/10 text-destructive",
  };
  const confidenceLabel =
    normalizedConfidence >= 85 ? "High certainty" : normalizedConfidence >= 60 ? "Moderate certainty" : "Needs review";
  const confidenceTone =
    normalizedConfidence >= 85 ? "text-success" : normalizedConfidence >= 60 ? "text-yellow-500" : "text-destructive";

  const analysisPoints = analysis.analysis
    .split(/(?:\.\s+|\n+)/)
    .map((point) => point.trim())
    .filter(Boolean);

  const recommendationPoints = analysis.recommendations
    .split(/(?:\.\s+|\n+)/)
    .map((point) => point.trim())
    .filter(Boolean);

  const quickInsights = [
    isPure ? "Signal profile aligns with expected healthy behavior." : "Signal profile shows traits that need closer review.",
    `${confidenceLabel} from the model based on supplied antenna parameters.`,
    analysis.risk_level === "Low"
      ? "Operational risk looks contained for the current reading."
      : analysis.risk_level === "Medium"
        ? "A follow-up check is recommended before relying on this result."
        : "High-risk reading detected; manual validation is strongly recommended.",
  ];

  const shareableSummary = [
    `Verdict: ${analysis.verdict}`,
    `Confidence: ${normalizedConfidence}% (${confidenceLabel})`,
    `Risk Level: ${analysis.risk_level}`,
    `Analysis: ${analysis.analysis}`,
    `Recommendations: ${analysis.recommendations}`,
  ].join("\n");

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(shareableSummary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-lg p-6 space-y-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI-Powered Analysis
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isPure ? "secondary" : "destructive"} className="gap-1">
              {isPure ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {analysis.verdict}
            </Badge>
            <Badge variant="outline" className={confidenceTone}>
              <Gauge className="mr-1 h-3.5 w-3.5" />
              {confidenceLabel}
            </Badge>
            <Badge variant="outline" className={riskAccent[analysis.risk_level] || "text-foreground"}>
              <Shield className="mr-1 h-3.5 w-3.5" />
              {analysis.risk_level} risk
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
            Powered by AI
          </span>
          <Button type="button" variant="outline" size="sm" onClick={handleCopySummary} className="gap-2">
            {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy Summary"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-primary shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">AI Snapshot</p>
            <p className="text-sm text-muted-foreground">
              {isPure
                ? "The model sees a clean antenna signature with fewer immediate concerns."
                : "The model detected conditions that may indicate impurity or instability in the reading."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Verdict */}
        <div className="rounded-lg bg-muted p-4 flex items-center gap-3">
          {isPure ? (
            <CheckCircle2 className="w-8 h-8 text-success shrink-0" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-destructive shrink-0" />
          )}
          <div>
            <p className="text-xs text-muted-foreground">AI Verdict</p>
            <p className={`text-lg font-bold font-mono ${isPure ? "text-success" : "text-destructive"}`}>
              {analysis.verdict}
            </p>
          </div>
        </div>

        {/* Confidence */}
        <div className="rounded-lg bg-muted p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`text-xs font-medium ${confidenceTone}`}>{confidenceLabel}</span>
              </TooltipTrigger>
              <TooltipContent>
                Higher confidence means the model found a stronger pattern match in the submitted data.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-lg font-bold font-mono text-foreground mb-2">{normalizedConfidence}%</p>
          <Progress value={normalizedConfidence} className="h-2" />
        </div>

        {/* Risk Level */}
        <div className="rounded-lg bg-muted p-4 flex items-center gap-3">
          <Shield className={`w-8 h-8 shrink-0 ${riskColors[analysis.risk_level] || "text-muted-foreground"}`} />
          <div>
            <p className="text-xs text-muted-foreground">Risk Level</p>
            <p className={`text-lg font-bold font-mono ${riskColors[analysis.risk_level] || "text-foreground"}`}>
              {analysis.risk_level}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-muted/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Quick Insights</p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {quickInsights.map((insight) => (
            <div key={insight} className="rounded-lg border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
              {insight}
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analysis">Deep Dive</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Technical Analysis</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.analysis}</p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
            <p className="text-sm font-medium text-primary">Primary Recommendation</p>
            <p className="text-sm text-muted-foreground">{analysis.recommendations}</p>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-3">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Extracted Analysis Points</p>
            </div>
            <div className="space-y-2">
              {(analysisPoints.length ? analysisPoints : [analysis.analysis]).map((point, index) => (
                <div key={`${point}-${index}`} className="flex items-start gap-3 rounded-md bg-background/70 p-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <p className="text-sm text-muted-foreground">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
            <p className="text-sm font-medium text-foreground mb-3">Recommended Next Steps</p>
            <div className="space-y-2">
              {(recommendationPoints.length ? recommendationPoints : [analysis.recommendations]).map((point, index) => (
                <div key={`${point}-${index}`} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p className="text-sm text-muted-foreground">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

export default AIAnalysisPanel;
