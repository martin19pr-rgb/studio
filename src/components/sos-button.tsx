
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, XCircle, Mic, Zap, Loader2, Waves, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { voiceAssistant } from '@/ai/flows/voice-assistant-flow';

export const SOSButton = () => {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'dispatched' | 'cancelled'>('idle');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { data: profile } = useDoc(user ? doc(db, 'users', user.uid) : null);

  const HOLD_DURATION = 2000;

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleAIConversation(transcript);
      };

      recognitionRef.current.onend = () => {
        if (status === 'listening') setStatus('idle');
      };

      recognitionRef.current.onerror = () => {
        setStatus('idle');
      };
    }
  }, [status]);

  // Hold Timer Logic
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

  const handleAIConversation = async (transcript: string) => {
    setStatus('processing');
    try {
      const response = await voiceAssistant({ 
        transcript,
        userName: profile?.name || 'Citizen',
        location: 'Polokwane, Limpopo',
        medicalNotes: profile ? `Blood: ${profile.bloodType}, Allergies: ${profile.allergies}` : undefined
      });
      
      setLastMessage(response.text);
      
      if (audioRef.current) {
        audioRef.current.src = response.audioDataUri;
        audioRef.current.onplay = () => setStatus('speaking');
        audioRef.current.onended = () => {
          setStatus('idle');
          // Brief window where it stays accessible for follow-up if needed
        };
        audioRef.current.play().catch(() => setStatus('idle'));
      } else {
        const audio = new Audio(response.audioDataUri);
        audioRef.current = audio;
        audio.onplay = () => setStatus('speaking');
        audio.onended = () => setStatus('idle');
        audio.play().catch(() => setStatus('idle'));
      }
    } catch (error) {
      setStatus('idle');
      toast({ variant: 'destructive', title: 'Connection Lost', description: 'Emergency services are still reachable via manual SOS.' });
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
      description: "Police and paramedics alerted. Family contacts notified.",
    });

    setTimeout(() => setStatus('idle'), 10000);
  };

  const handleCancel = () => {
    setStatus('cancelled');
    setTimeout(() => setStatus('idle'), 2000);
  };

  const toggleVoiceAssistant = () => {
    if (status === 'listening') {
      recognitionRef.current?.stop();
      setStatus('idle');
    } else if (status === 'idle') {
      setStatus('listening');
      recognitionRef.current?.start();
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      <AnimatePresence>
        {lastMessage && (status === 'speaking' || status === 'processing') && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card bg-accent/10 border-accent/20 p-4 max-w-xs text-center mb-2"
          >
            <p className="text-xs text-white/90 leading-relaxed font-medium">
              {status === 'processing' ? 'Routing intel to Command...' : lastMessage}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-72 h-72 flex items-center justify-center">
        {/* Ambient Pulse for Listening/Speaking */}
        <AnimatePresence>
          {(status === 'listening' || status === 'speaking' || status === 'processing') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.6, scale: 1.3 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className={cn(
                "absolute inset-0 rounded-full blur-3xl -z-10",
                status === 'speaking' ? "bg-primary/30" : "bg-accent/30"
              )}
            />
          )}
        </AnimatePresence>

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
            // Only toggle voice assistant if it's a quick tap and not already dispatched
            if (progressRef.current < 10 && status !== 'dispatched') {
              toggleVoiceAssistant();
            }
          }}
          animate={status === 'idle' ? { 
            scale: isHolding ? 0.92 : 1,
          } : { scale: 1 }}
          className={cn(
            "relative w-60 h-60 rounded-full glass-card flex flex-col items-center justify-center gap-2 transition-all duration-500",
            status === 'idle' && !isHolding && "bg-destructive/40 border-destructive text-destructive shadow-[0_0_60px_rgba(239,68,68,0.3)]",
            isHolding && "bg-destructive/60 scale-95 ring-4 ring-destructive glow-accent",
            status === 'listening' && "bg-accent/20 border-accent text-accent ring-4 ring-accent glow-accent",
            status === 'processing' && "bg-accent/10 border-accent/40 animate-pulse",
            status === 'speaking' && "bg-primary/20 border-primary text-primary ring-4 ring-primary glow-green",
            status === 'dispatched' && "bg-primary/40 border-primary text-primary ring-8 ring-primary/20 glow-green",
            status === 'cancelled' && "ring-4 ring-destructive/40"
          )}
        >
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center z-10"
              >
                <ShieldAlert className={cn("w-20 h-20 mb-2 transition-colors", isHolding ? "text-white" : "text-destructive")} />
                <span className="font-headline text-4xl font-bold tracking-tighter text-white">SOS</span>
                <span className="text-[10px] uppercase tracking-widest text-white/70 mt-1">
                  {isHolding ? "TRIGGERING..." : "TAP TO TALK • HOLD SOS"}
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

            {status === 'speaking' && (
              <motion.div key="speaking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center text-primary">
                <Waves className="w-20 h-20 mb-2 animate-pulse" />
                <span className="font-headline text-xl font-bold uppercase">Provincial AI</span>
              </motion.div>
            )}

            {status === 'dispatched' && (
              <motion.div
                key="dispatched"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-primary z-10"
              >
                <CheckCircle2 className="w-24 h-24 mb-2" />
                <span className="font-headline text-2xl font-bold uppercase text-center">Help Sent</span>
              </motion.div>
            )}

            {status === 'cancelled' && (
              <motion.div
                key="cancelled"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-destructive z-10"
              >
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
          Guardian Link Active
        </p>
        <p className="text-muted-foreground text-[10px] mt-3 max-w-[280px] mx-auto leading-relaxed uppercase tracking-[0.2em] opacity-70">
          "Police" • "Ambulance" • "Medical" • "Fire"
        </p>
      </div>
    </div>
  );
};
