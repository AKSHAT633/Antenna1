import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vswr, reflection } = await req.json();

    if (typeof vswr !== "number" || typeof reflection !== "number") {
      return new Response(JSON.stringify({ error: "Invalid input: vswr and reflection must be numbers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert RF antenna engineer and food safety scientist specializing in non-invasive food adulteration detection using microwave antenna parameters.

Given antenna measurement data (VSWR and Reflection Coefficient in dB), analyze whether the food sample is likely pure or adulterated.

Key principles:
- VSWR < 2 and Reflection < -10 dB generally indicates pure food (good impedance matching, minimal dielectric anomaly)
- VSWR >= 2 or Reflection >= -10 dB suggests adulteration (dielectric property changes from foreign substances)
- Higher VSWR indicates worse impedance matching, potentially caused by adulterants changing the food's dielectric constant
- Reflection closer to 0 dB means more energy reflected back, indicating sample property changes

Respond with a JSON object containing:
- "verdict": either "Pure" or "Adulterated"
- "confidence": a percentage (0-100) indicating confidence level
- "analysis": a brief 2-3 sentence technical explanation
- "risk_level": "Low", "Medium", or "High"
- "recommendations": a short recommendation string`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this antenna measurement data for food adulteration:\n- VSWR: ${vswr}\n- Reflection Coefficient: ${reflection} dB` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "food_analysis_result",
              description: "Return structured food adulteration analysis",
              parameters: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["Pure", "Adulterated"] },
                  confidence: { type: "number", minimum: 0, maximum: 100 },
                  analysis: { type: "string" },
                  risk_level: { type: "string", enum: ["Low", "Medium", "High"] },
                  recommendations: { type: "string" },
                },
                required: ["verdict", "confidence", "analysis", "risk_level", "recommendations"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "food_analysis_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No structured response from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-food error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
