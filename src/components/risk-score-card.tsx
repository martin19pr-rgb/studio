
"use client";

import React, { useEffect, useState } from 'react';
import { GlassCard } from './glass-card';
import { TrendingDown, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { getPredictiveSafetyAdvice, type PredictiveSafetyAdviceOutput } from '@/ai/flows/predictive-safety-advice-flow';
import { cn } from '@/lib/utils';

export const RiskScoreCard = () => {
  const [data, setData] = useState<PredictiveSafetyAdviceOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRisk = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPredictiveSafetyAdvice({
        latitude: -23.9045,
        longitude: 29.4688, // Polokwane
        timeOfDay: new Date().toLocaleTimeString(),
        crimeHistory: "High incidence of vehicle theft in downtown area",
        trafficConditions: "Moderate flowing traffic",
        recentIncidents: "Minor fender bender reported 2km North"
      });
      setData(result);
    } catch (e: any) {
      // Check for Genkit quota errors
      const errorMessage = e.message?.toLowerCase() || "";
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('exhausted')) {
        setError('AI Analysis busy. Standard safety active.');
      } else {
        setError('Live analysis paused.');
      }
      
      // Provide generic fallback data if AI is down
      if (!data) {
        setData({
          riskScorePercentage: 5,
          threatLevel: 'LOW',
          advice: "Maintain standard safety protocols. Guardian recording is active."
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRisk();
  }, []);

  if (loading && !data) return (
    <GlassCard className="animate-pulse flex flex-col gap-4">
      <div className="h-4 bg-white/10 rounded w-1/3" />
      <div className="h-12 bg-white/10 rounded" />
    </GlassCard>
  );

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {error ? "System Safety Analysis" : "Personal Risk Analysis"}
        </span>
        <button onClick={loadRisk} disabled={loading} className={cn("p-1 hover:bg-white/10 rounded-full transition-all", loading && "animate-spin")}>
          <RefreshCw className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
      
      <div className="flex items-end gap-2">
        <span className="text-4xl font-headline text-white font-bold">
          {data?.riskScorePercentage || 0}%
        </span>
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full border mb-1",
          data?.threatLevel === 'LOW' ? "text-primary border-primary/30 bg-primary/10" : 
          data?.threatLevel === 'MEDIUM' ? "text-accent border-accent/30 bg-accent/10" :
          "text-destructive border-destructive/30 bg-destructive/10"
        )}>
          {data?.threatLevel || 'LOW'} THREAT
        </span>
      </div>

      <div className={cn(
        "flex gap-3 items-center p-3 rounded-xl border mt-1 transition-colors",
        error ? "bg-yellow-500/5 border-yellow-500/20" : "bg-white/5 border-white/10"
      )}>
        {error ? <AlertTriangle className="w-8 h-8 text-yellow-500 shrink-0" /> : <ShieldCheck className="w-8 h-8 text-primary shrink-0" />}
        <div className="flex flex-col">
          <p className="text-xs text-white/80 leading-relaxed font-medium">
            {data?.advice || "System initializing..."}
          </p>
          {error && <p className="text-[9px] text-muted-foreground mt-1 italic">{error}</p>}
        </div>
      </div>
    </GlassCard>
  );
};
