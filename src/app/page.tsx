
"use client";

import React, { useState } from 'react';
import { SOSButton } from '@/components/sos-button';
import { Navigation } from '@/components/navigation';
import { GlassCard } from '@/components/glass-card';
import { RiskScoreCard } from '@/components/risk-score-card';
import { VoiceGuardian } from '@/components/voice-guardian';
import { Bell, Shield, UserCheck, Wind } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const [isListening, setIsListening] = useState(false);

  return (
    <main className="min-h-screen pb-32 pt-12 px-6 flex flex-col max-w-2xl mx-auto">
      <VoiceGuardian onStatusChange={setIsListening} />
      
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-white">Provincial Safety</h1>
          <p className="text-primary text-xs font-bold tracking-widest uppercase">Limpopo Command</p>
        </div>
        <div className="flex gap-3">
          <button className="p-3 glass-card rounded-full relative">
            <Bell className="w-5 h-5 text-primary" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-background shadow-[0_0_10px_rgba(173,232,66,0.6)]" />
          </button>
          <button className="p-3 glass-card rounded-full">
            <UserCheck className="w-5 h-5 text-primary" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8">
        {/* SOS Central Piece - Now handles all AI interaction */}
        <section className="flex flex-col items-center justify-center py-6">
          <SOSButton />
        </section>

        {/* Real-time Status Grid */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard className="flex flex-col gap-2 p-4">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nearby Responders</span>
            <span className="text-2xl font-headline font-bold text-white">14</span>
            <span className="text-[10px] text-primary font-medium">Estimated 4m ETA</span>
          </GlassCard>
          <GlassCard className="flex flex-col gap-2 p-4">
            <Wind className="w-5 h-5 text-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Drone Units</span>
            <span className="text-2xl font-headline font-bold text-white">03</span>
            <span className="text-[10px] text-accent font-medium">Ready for dispatch</span>
          </GlassCard>
        </div>

        {/* Predictive Advice */}
        <RiskScoreCard />

        {/* Recent Alerts Quick View */}
        <section>
          <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 ml-1">Recent Activity Near You</h2>
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <GlassCard key={i} className="flex items-center gap-4 p-3 hover:bg-white/10 cursor-pointer group">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                  <Image 
                    src={`https://picsum.photos/seed/alert${i}/200/200`} 
                    alt="Alert" 
                    fill 
                    sizes="(max-width: 768px) 100vw, 200px"
                    className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    data-ai-hint="security footage"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Vehicle Threat Blocked</p>
                  <p className="text-[10px] text-muted-foreground">Polokwane North • 1.2km away</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-primary">SECURED</p>
                  <p className="text-[10px] text-muted-foreground">4m ago</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      </div>

      <Navigation />
    </main>
  );
}
