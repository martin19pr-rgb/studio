
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, XCircle, Mic, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface SOSButtonProps {
  listening?: boolean;
}

export const SOSButton = ({ listening = false }: SOSButtonProps) => {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'dispatched' | 'cancelled'>('idle');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<number>(0);
  const { toast } = useToast();
  
  const db = useFirestore();
  const { user } = useUser();

  const HOLD_DURATION = 2000;

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
      description: "Police and paramedics alerted. Family contacts Annah and Thabo notified.",
    });

    setTimeout(() => {
      setStatus('idle');
    }, 15000);
  };

  const handleCancel = () => {
    setStatus('cancelled');
    setTimeout(() => setStatus('idle'), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Ghost Light Pulse - Prominent when Listening */}
        <AnimatePresence>
          {listening && status === 'idle' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.5, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-primary/30 blur-3xl -z-10"
            />
          )}
        </AnimatePresence>

        {/* Progress Ring */}
        <svg className="absolute w-full h-full -rotate-90">
          <circle
            cx="128"
            cy="128"
            r="110"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="10"
            className="text-white/5"
          />
          <motion.circle
            cx="128"
            cy="128"
            r="110"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="10"
            strokeDasharray="691"
            strokeDashoffset={691 - (691 * progress) / 100}
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
          animate={status === 'idle' ? { 
            scale: isHolding ? 0.92 : 1,
          } : {}}
          className={cn(
            "relative w-52 h-52 rounded-full glass-card flex flex-col items-center justify-center gap-2 transition-all duration-500",
            status === 'idle' && !isHolding && "bg-destructive/40 border-destructive text-destructive shadow-[0_0_50px_rgba(239,68,68,0.4)]",
            isHolding && "bg-destructive/60 scale-95 ring-4 ring-destructive glow-accent",
            status === 'dispatched' && "bg-primary/20 border-primary text-primary ring-4 ring-primary glow-green",
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
                {listening ? (
                   <div className="relative">
                      <Mic className="w-16 h-16 mb-2 text-white animate-pulse" />
                      <Zap className="absolute -top-1 -right-1 w-4 h-4 text-accent animate-bounce" />
                   </div>
                ) : (
                  <ShieldAlert className={cn("w-16 h-16 mb-2 transition-colors", isHolding ? "text-white" : "text-destructive")} />
                )}
                <span className="font-headline text-3xl font-bold tracking-tighter text-white">SOS</span>
                <span className="text-[10px] uppercase tracking-widest text-white/70 mt-1">
                  {isHolding ? "TRIGGERING..." : listening ? "LISTENING..." : "HOLD TO DISPATCH"}
                </span>
              </motion.div>
            )}

            {status === 'dispatched' && (
              <motion.div
                key="dispatched"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-primary z-10"
              >
                <CheckCircle2 className="w-20 h-20 mb-2" />
                <span className="font-headline text-xl font-bold uppercase text-center">Help Received</span>
                <span className="text-[8px] uppercase tracking-widest mt-1">Command Sync: OK</span>
              </motion.div>
            )}

            {status === 'cancelled' && (
              <motion.div
                key="cancelled"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-destructive z-10"
              >
                <XCircle className="w-20 h-20 mb-2" />
                <span className="font-headline text-xl font-bold">CANCELLED</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <div className="text-center">
        <p className="text-primary font-medium tracking-wide flex items-center justify-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
          Guardian Response Active
        </p>
        <p className="text-muted-foreground text-[10px] mt-2 max-w-[240px] mx-auto leading-tight uppercase tracking-widest opacity-60">
          "Police" • "Ambulance" • "Fire" • "Help"
        </p>
      </div>
    </div>
  );
};
