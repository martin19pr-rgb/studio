
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, XCircle, Mic, Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { voiceCommandIntent } from '@/ai/flows/voice-command-intent-flow';

export const SOSButton = () => {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'dispatched' | 'cancelled'>('idle');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { data: profile } = useDoc(user ? doc(db, 'users', user.uid) : null);

  const HOLD_DURATION = 2000;

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceCommand(transcript);
      };

      recognitionRef.current.onend = () => {
        if (status === 'listening') setStatus('idle');
      };

      recognitionRef.current.onerror = () => {
        setStatus('idle');
      };
    }
  }, [status]);

  useEffect(() => {
    if (isHolding && status === 'idle') {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
        setProgress(newProgress);
        progressRef.current = newProgress;

        if (newProgress === 100) {
          handleDispatch('manual_sos');
        }
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressRef.current < 100 && progressRef.current > 0) {
        handleCancel();
      }
      setProgress(0);
      progressRef.current = 0;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHolding, status]);

  const handleVoiceCommand = async (transcript: string) => {
    setStatus('processing');
    try {
      const result = await voiceCommandIntent({ transcript });
      if (result.serviceDispatched) {
        handleDispatch(result.intent);
        toast({
          title: result.feedbackMessage.split('•')[0].trim(),
          description: result.feedbackMessage,
        });
      } else {
        setStatus('idle');
        toast({ title: "Command not recognized", description: "Please try: 'Send Police', 'Medical', or 'Help'" });
      }
    } catch (error) {
      setStatus('idle');
    }
  };

  const handleDispatch = (type: string) => {
    setIsHolding(false);
    setStatus('dispatched');
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (db) {
      const incidentData = {
        userId: user?.uid || 'anonymous',
        type: type,
        status: 'dispatched',
        timestamp: serverTimestamp(),
        location: { lat: -23.9045, lng: 29.4688 }
      };
      
      const incidentsRef = collection(db, 'incidents');
      addDoc(incidentsRef, incidentData).catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: incidentsRef.path,
          operation: 'create',
          requestResourceData: incidentData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    }

    toast({
      title: `${type.toUpperCase().replace('_', ' ')} DISPATCHED`,
      description: "Emergency services alerted. Guardian network notified.",
    });

    setTimeout(() => setStatus('idle'), 10000);
  };

  const handleCancel = () => {
    setStatus('cancelled');
    setTimeout(() => setStatus('idle'), 2000);
  };

  const toggleVoiceTrigger = () => {
    if (status === 'listening') {
      recognitionRef.current?.stop();
    } else if (status === 'idle') {
      setStatus('listening');
      recognitionRef.current?.start();
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      <div className="relative w-72 h-72 flex items-center justify-center">
        {/* Ghost Light Pulse (Always-On indication) */}
        <div className="absolute inset-0 rounded-full bg-primary/5 border border-primary/10 animate-pulse-glow" />

        {/* Progress Ring */}
        <svg className="absolute w-full h-full -rotate-90">
          <circle
            cx="144"
            cy="144"
            r="125"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="12"
            className="text-white/5"
          />
          <motion.circle
            cx="144"
            cy="144"
            r="125"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray="785"
            strokeDashoffset={785 - (785 * progress) / 100}
            strokeLinecap="round"
            className={cn(
              "transition-colors duration-300",
              progress < 100 ? "text-destructive" : "text-primary"
            )}
          />
        </svg>

        <motion.button
          onMouseDown={() => setIsHolding(true)}
          onMouseUp={() => setIsHolding(false)}
          onMouseLeave={() => setIsHolding(false)}
          onTouchStart={() => setIsHolding(true)}
          onTouchEnd={() => setIsHolding(false)}
          onClick={(e) => {
            if (progressRef.current < 10 && status !== 'dispatched') {
              toggleVoiceTrigger();
            }
          }}
          animate={status === 'idle' ? { scale: isHolding ? 0.92 : 1 } : { scale: 1 }}
          className={cn(
            "relative w-60 h-60 rounded-full glass-card flex flex-col items-center justify-center gap-2 transition-all duration-500",
            status === 'idle' && !isHolding && "bg-destructive/40 border-destructive text-destructive shadow-[0_0_60px_rgba(239,68,68,0.3)]",
            isHolding && "bg-destructive/60 scale-95 ring-4 ring-destructive glow-accent",
            status === 'listening' && "bg-accent/20 border-accent text-accent ring-4 ring-accent glow-accent",
            status === 'processing' && "bg-accent/10 border-accent/40 animate-pulse",
            status === 'dispatched' && "bg-primary/40 border-primary text-primary ring-8 ring-primary/20 glow-green",
            status === 'cancelled' && "ring-4 ring-destructive/40"
          )}
        >
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                <ShieldAlert className={cn("w-20 h-20 mb-2 transition-colors", isHolding ? "text-white" : "text-destructive")} />
                <span className="font-headline text-4xl font-bold tracking-tighter text-white">SOS</span>
                <span className="text-[10px] uppercase tracking-widest text-white/70 mt-1">
                  {isHolding ? "HOLDING..." : "TAP TO TALK • HOLD"}
                </span>
              </motion.div>
            )}

            {status === 'listening' && (
              <motion.div key="listening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                <Mic className="w-20 h-20 mb-2 text-accent animate-pulse" />
                <span className="font-headline text-xl font-bold uppercase">Listening...</span>
              </motion.div>
            )}

            {status === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                <Loader2 className="w-20 h-20 mb-2 text-accent animate-spin" />
                <span className="font-headline text-xl font-bold uppercase">Routing...</span>
              </motion.div>
            )}

            {status === 'dispatched' && (
              <motion.div key="dispatched" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center text-primary">
                <CheckCircle2 className="w-24 h-24 mb-2" />
                <span className="font-headline text-2xl font-bold uppercase">Help Sent</span>
              </motion.div>
            )}

            {status === 'cancelled' && (
              <motion.div key="cancelled" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center text-destructive">
                <XCircle className="w-24 h-24 mb-2" />
                <span className="font-headline text-2xl font-bold">CANCELLED</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <div className="text-center">
        <p className="text-primary font-bold tracking-widest text-xs uppercase flex items-center justify-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
          Provincial Command Link Active
        </p>
        <p className="text-muted-foreground text-[10px] mt-3 max-w-[280px] mx-auto leading-relaxed uppercase tracking-[0.2em] opacity-70">
          "Police" • "Ambulance" • "Medical" • "Fire"
        </p>
      </div>
    </div>
  );
};
