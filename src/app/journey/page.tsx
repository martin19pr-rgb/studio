"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from '@/components/navigation';
import { DualCameraPreview } from '@/components/dual-camera-preview';
import { GlassCard } from '@/components/glass-card';
import { VoiceGuardian } from '@/components/voice-guardian';
import { MapPin, Navigation as NavIcon, Eye, ShieldAlert, FastForward, Power, Timer, Activity } from 'lucide-react';

export default function JourneyPage() {
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [destination, setDestination] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (journeyStarted && !isFinished) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        setDistance(prev => prev + (Math.random() * 0.02)); // Simulated distance increment
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [journeyStarted, isFinished]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndJourney = () => {
    setJourneyStarted(false);
    setIsFinished(true);
    // Logic to "Save to Cloud" would go here
  };

  return (
    <main className="min-h-screen relative flex flex-col p-6 max-w-5xl mx-auto">
      <VoiceGuardian />
      
      {/* Background Simulated Map */}
      <div className="fixed inset-0 z-0 opacity-40">
        <div 
          className="w-full h-full bg-cover bg-center grayscale contrast-125"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=2066&auto=format&fit=crop)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      </div>

      <div className="relative z-10 flex flex-col gap-6 pt-10">
        <div className="flex justify-between items-center">
          <GlassCard className="py-2 px-4 rounded-full border-primary/20 flex items-center gap-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse glow-green" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {journeyStarted ? "Journey Protection Active" : "Guardian Standby"}
            </span>
          </GlassCard>
          <GlassCard className="py-2 px-4 rounded-full border-accent/20 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">N1 • Mokopane</span>
          </GlassCard>
        </div>

        {/* Operational Interface */}
        <section className="mt-4">
          <DualCameraPreview />
        </section>

        {!journeyStarted && !isFinished ? (
          <GlassCard className="flex flex-col gap-4 p-8 bg-primary/5">
            <h2 className="font-headline text-2xl font-bold">Start Your Journey</h2>
            <p className="text-sm text-white/60">Enter a destination or skip to begin recording immediately.</p>
            <div className="flex flex-col gap-4 mt-2">
              <input 
                type="text" 
                placeholder="Where are you going?" 
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:ring-1 ring-primary"
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => setJourneyStarted(true)}
                  className="flex-1 py-4 bg-primary text-background font-bold uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Start Guardian
                </button>
                <button 
                  onClick={() => { setDestination('Roaming Protection'); setJourneyStarted(true); }}
                  className="flex-1 py-4 bg-white/10 text-white font-bold uppercase tracking-widest rounded-xl border border-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                  <FastForward className="w-4 h-4" /> Skip
                </button>
              </div>
            </div>
          </GlassCard>
        ) : isFinished ? (
          <GlassCard className="flex flex-col gap-6 p-8 bg-accent/10 border-accent/20">
            <div className="flex flex-col items-center text-center gap-2">
              <ShieldAlert className="w-12 h-12 text-accent glow-accent mb-2" />
              <h2 className="font-headline text-2xl font-bold">Journey Secured</h2>
              <p className="text-sm text-white/60">Recording uploaded to provincial cloud storage.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Total Time</p>
                <p className="text-xl font-headline font-bold text-white">{formatTime(elapsedTime)}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Total Distance</p>
                <p className="text-xl font-headline font-bold text-white">{distance.toFixed(2)} KM</p>
              </div>
            </div>
            <button 
              onClick={() => { setIsFinished(false); setElapsedTime(0); setDistance(0); setDestination(''); }}
              className="w-full py-4 bg-primary text-background font-bold uppercase tracking-widest rounded-xl"
            >
              New Journey
            </button>
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GlassCard className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-4 mb-4">
                  <NavIcon className="w-6 h-6 text-primary" />
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</p>
                    <p className="text-lg font-headline font-bold">{destination || 'Roaming'}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Timer className="w-3 h-3 text-primary" />
                      <p className="text-[10px] text-muted-foreground uppercase">Time Elapsed</p>
                    </div>
                    <p className="text-xl font-headline font-bold">{formatTime(elapsedTime)}</p>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/5">
                     <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-3 h-3 text-accent" />
                      <p className="text-[10px] text-muted-foreground uppercase">Distance</p>
                    </div>
                    <p className="text-xl font-headline font-bold">{distance.toFixed(2)} KM</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="flex flex-col gap-3 justify-center items-center text-center p-8 bg-primary/10 border-primary/20">
                <Eye className="w-12 h-12 text-primary glow-green mb-2" />
                <h3 className="font-headline text-lg font-bold uppercase">Eyes on Road</h3>
                <p className="text-xs text-white/60">Continuous recording active. AI scan initialized.</p>
              </GlassCard>
            </div>
            
            <button 
              onClick={handleEndJourney}
              className="w-full py-6 bg-destructive text-destructive-foreground rounded-[24px] font-headline font-bold text-xl uppercase tracking-tighter flex items-center justify-center gap-4 border-2 border-destructive/50 hover:bg-destructive/90 transition-all"
            >
              <Power className="w-6 h-6" /> End Journey & Log Evidence
            </button>
          </div>
        )}

        <GlassCard className="bg-destructive/10 border-destructive/20 flex items-center gap-6 p-6">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center border border-destructive/40 shrink-0">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div className="flex-1">
            <h4 className="font-headline text-xl font-bold text-white uppercase tracking-tight">Rapid Threat Protocol</h4>
            <p className="text-sm text-white/70 leading-relaxed max-w-md">
              The SOS button and Voice Activation are live. Use voice commands like "Send Police" if your hands are busy.
            </p>
          </div>
        </GlassCard>
      </div>

      <Navigation />
    </main>
  );
}
