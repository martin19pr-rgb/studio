"use client";

import React, { useState, useRef, useEffect } from 'react';
import { GlassCard } from './glass-card';
import { Mic, X, Bot, Volume2, Loader2, Waves } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { voiceAssistant } from '@/ai/flows/voice-assistant-flow';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

export const EmergencyChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Provincial Command active. Speak to me, I am here to assist.' }
  ]);
  
  const { user } = useUser();
  const db = useFirestore();
  const { data: profile } = useDoc(user ? doc(db, 'users', user.uid) : null);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceInput(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handleVoiceInput = async (transcript: string) => {
    setIsProcessing(true);
    setMessages(prev => [...prev, { role: 'user', text: transcript }]);

    try {
      const response = await voiceAssistant({ 
        transcript,
        userName: profile?.name || 'Citizen',
        location: 'N1 North, Polokwane', // Real app would use geolocation
        medicalNotes: profile ? `Blood: ${profile.bloodType}, Allergies: ${profile.allergies}` : undefined
      });
      
      setMessages(prev => [...prev, { role: 'assistant', text: response.text }]);
      
      // Play audio response and handle speaking state
      if (audioRef.current) {
        audioRef.current.src = response.audioDataUri;
        audioRef.current.onplay = () => setIsSpeaking(true);
        audioRef.current.onended = () => setIsSpeaking(false);
        audioRef.current.play().catch(e => console.error("Audio playback blocked", e));
      } else {
        const audio = new Audio(response.audioDataUri);
        audioRef.current = audio;
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => setIsSpeaking(false);
        audio.play().catch(e => console.error("Audio playback blocked", e));
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: "Signal lost. Please use the SOS button if you are in danger." }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-32 right-6 p-4 rounded-full bg-accent text-accent-foreground shadow-lg hover:scale-105 transition-transform z-40 glow-accent"
      >
        <Bot className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed inset-x-6 bottom-32 top-24 z-50 md:left-auto md:right-6 md:w-96 flex flex-col"
          >
            <GlassCard className="h-full flex flex-col p-0 overflow-hidden border-accent/20">
              <div className="p-4 border-b border-white/10 bg-accent/10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Bot className="w-5 h-5 text-accent" />
                    {(isListening || isProcessing || isSpeaking) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-ping" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white">Safety Assistant</h3>
                    <p className="text-[10px] text-accent font-medium">Command Network Live</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {messages.map((msg, i) => (
                  <div key={i} className={cn(
                    "max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed transition-all",
                    msg.role === 'assistant' 
                      ? "bg-white/5 text-white/90 self-start border border-white/5" 
                      : "bg-accent/20 text-white self-end border border-accent/20 shadow-lg"
                  )}>
                    {msg.role === 'assistant' && <Volume2 className={cn("w-3 h-3 mb-1 text-accent inline-block mr-2", isSpeaking && i === messages.length -1 && "animate-pulse")} />}
                    {msg.text}
                  </div>
                ))}
                {isProcessing && (
                  <div className="self-start bg-white/5 p-4 rounded-2xl border border-white/5 animate-pulse flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                    <span className="text-[10px] uppercase font-bold text-accent tracking-tighter">Command Thinking...</span>
                  </div>
                )}
              </div>

              <div className="p-6 bg-white/5 flex flex-col items-center gap-4">
                <div className="relative">
                   <button 
                    onClick={toggleListening}
                    disabled={isProcessing || isSpeaking}
                    className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 z-10 relative",
                      isListening 
                        ? "bg-destructive/40 ring-4 ring-destructive animate-pulse scale-110" 
                        : isSpeaking
                        ? "bg-primary/20 ring-4 ring-primary animate-pulse"
                        : "bg-accent/20 border-2 border-accent/40 text-accent hover:bg-accent/30"
                    )}
                  >
                    {isSpeaking ? <Waves className="w-8 h-8 text-primary" /> : <Mic className={cn("w-8 h-8", isListening ? "text-white" : "text-accent")} />}
                  </button>
                  {isSpeaking && (
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse -z-0" />
                  )}
                </div>
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest text-center">
                  {isListening ? "Listening..." : isProcessing ? "Routing Intel..." : isSpeaking ? "AI Assistant Speaking..." : "Tap to Speak to Command"}
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
