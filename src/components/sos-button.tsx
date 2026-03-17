
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, XCircle, Mic, Zap, Loader2, Waves, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { voiceCommandIntent } from '@/ai/flows/voice-command-intent-flow';
import { voiceAssistant } from '@/ai/flows/voice-assistant-flow';

export const SOSButton = () => {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'dispatched' | 'cancelled'>('idle');
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { data: profile } = useDoc(user ? doc(db, 'users', user.uid) : null);

  const HOLD_DURATION = 2000;

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleConversation(transcript);
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

  const handleConversation = async (transcript: string) => {
    setStatus('processing');
    setAiMessage(null);

    try {
      // First, check if it's a direct dispatch intent
      const intentResult = await voiceCommandIntent({ transcript });
      
      if (intentResult.serviceDispatched) {
        handleDispatch(intentResult.intent);
        setAiMessage(intentResult.feedbackMessage);
        return;
      }

      // If not a direct dispatch, use the conversational assistant for guidance
      const assistantResult = await voiceAssistant({
        transcript,
        userName: profile?.name || 'Citizen',
        location: 'Polokwane Central', // In real app, use geolocation
        medicalNotes: profile ? `Blood: ${profile.bloodType}, Allergies: ${profile.allergies}` : undefined
      });

      setAiMessage(assistantResult.text);
      
      if (assistantResult.audioDataUri) {
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = assistantResult.audioDataUri;
        audioRef.current.onplay = () => setStatus('speaking');
        audioRef.current.onended = () => setStatus('idle');
        audioRef.current.play().catch(e => setStatus('idle'));
      } else {
        setStatus('idle');
      }

    } catch (error) {
      setStatus('idle');
      toast({ variant: 'destructive', title: "Signal Weak", description: "Could not reach Provincial Command." });
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

    setTimeout(() => {
      setStatus('idle');
      setAiMessage(null);
    }, 10000);
  };

  const handleCancel = () => {
    setStatus('cancelled');
    setTimeout(() => setStatus('idle'), 2000);
  };

  const toggleVoiceMode = () => {
    if (status === 'speaking') {
      audioRef.current?.pause();
      setStatus('idle');
      return;
    }

    if (status === 'listening') {
      recognitionRef.current?.stop();
    } else {
      setStatus('listening');
      recognitionRef.current?.start();
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      <div className="relative w-80 h-80 flex items-center justify-center">
        {/* Ghost Light Pulse (Always-On indication) */}
        <div className="absolute inset-0 rounded-full bg-primary/5 border border-primary/10 animate-pulse-glow" />

        {/* Progress Ring for Manual SOS */}
        <svg className="absolute w-full h-full -rotate-90">
          <circle
            cx="160"
            cy="160"
            r="140"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="12"
            className="text-white/5"
          />
          <motion.circle
            cx="160"
            cy="160"
            r="140"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray="880"
            strokeDashoffset={880 - (880 * progress) / 100}
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
            // If it's a quick tap, start the AI conversation
            if (progressRef.current < 10 && (status === 'idle' || status === 'speaking')) {
              toggleVoiceMode();
            }
          }}
          animate={status === 'idle' ? { scale: isHolding ? 0.92 : 1 } : { scale: 1 }}
          className={cn(
            "relative w-64 h-64 rounded-full glass-card flex flex-col items-center justify-center gap-2 transition-all duration-500",
            status === 'idle' && !isHolding && "bg-destructive/40 border-destructive text-destructive shadow-[0_0_60px_rgba(239,68,68,0.3)]",
            isHolding && "bg-destructive/60 scale-95 ring-4 ring-destructive glow-accent",
            status === 'listening' && "bg-accent/20 border-accent text-accent ring-4 ring-accent glow-accent scale-110",
            status === 'processing' && "bg-accent/10 border-accent/40 animate-pulse",
            status === 'speaking' && "bg-primary/20 border-primary text-primary ring-4 ring-primary glow-green",
            status === 'dispatched' && "bg-primary/40 border-primary text-primary ring-8 ring-primary/20 glow-green",
            status === 'cancelled' && "ring-4 ring-destructive/40"
          )}
        >
          <AnimatePresence mode="wait">
            {(status === 'idle' || isHolding) && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                <div className="relative mb-2">
                  <ShieldAlert className={cn("w-20 h-20 transition-colors", isHolding ? "text-white" : "text-destructive")} />
                  <Mic className="absolute -bottom-1 -right-1 w-6 h-6 text-white/60 bg-black/40 rounded-full p-1" />
                </div>
                <span className="font-headline text-4xl font-bold tracking-tighter text-white">SOS</span>
                <span className="text-[10px] uppercase tracking-widest text-white/70 mt-1">
                  {isHolding ? "HOLDING..." : "TAP TO TALK • HOLD"}
                </span>
              </motion.div>
            )}

            {status === 'listening' && (
              <motion.div key="listening" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
                <Mic className="w-20 h-20 mb-2 text-accent animate-pulse" />
                <span className="font-headline text-xl font-bold uppercase tracking-widest text-accent">Listening...</span>
              </motion.div>
            )}

            {status === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                <Loader2 className="w-20 h-20 mb-2 text-accent animate-spin" />
                <span className="font-headline text-xl font-bold uppercase tracking-widest">Analysing...</span>
              </motion.div>
            )}

            {status === 'speaking' && (
              <motion.div key="speaking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                <Waves className="w-24 h-24 mb-2 text-primary animate-pulse" />
                <Volume2 className="w-6 h-6 text-primary absolute bottom-12" />
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

      <div className="text-center w-full px-6 min-h-[60px] flex flex-col items-center justify-center">
        {aiMessage ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="glass-card py-3 px-6 border-accent/20 max-w-sm"
          >
            <p className="text-sm font-medium text-white/90 leading-relaxed italic">
              "{aiMessage}"
            </p>
          </motion.div>
        ) : (
          <>
            <p className="text-primary font-bold tracking-widest text-xs uppercase flex items-center justify-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              Provincial Safety Network Active
            </p>
            <p className="text-muted-foreground text-[10px] mt-3 max-w-[280px] mx-auto leading-relaxed uppercase tracking-[0.2em] opacity-70">
              "Send Police" • "Medical" • "Help Me"
            </p>
          </>
        )}
      </div>
    </div>
  );
};
