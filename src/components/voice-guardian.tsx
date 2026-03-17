
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { voiceCommandIntent } from '@/ai/flows/voice-command-intent-flow';
import { postIncidentDebrief } from '@/ai/flows/post-incident-debrief-flow';
import { useToast } from '@/hooks/use-toast';

interface VoiceGuardianProps {
  onStatusChange?: (listening: boolean) => void;
  onDispatch?: (type: string) => void;
}

export const VoiceGuardian = ({ onStatusChange, onDispatch }: VoiceGuardianProps) => {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const recognitionRef = useRef<any>(null);
  const isStartedRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
    }

    const startRecognition = () => {
      if (recognitionRef.current && !isStartedRef.current) {
        try {
          recognitionRef.current.start();
          isStartedRef.current = true;
        } catch (e) {
          // Ignore errors
        }
      }
    };

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      onStatusChange?.(true);
    };

    recognitionRef.current.onresult = async (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      
      try {
        const result = await voiceCommandIntent({ transcript });
        
        if (result.serviceDispatched && result.intent !== 'none') {
          // If the service is dispatched, call the prop to update global state if needed
          onDispatch?.(result.intent);
          
          toast({
            title: result.feedbackMessage.split('•')[0].trim(),
            description: result.feedbackMessage,
          });

          // Audio feedback
          try {
            const audioResponse = await postIncidentDebrief({
              incidentType: result.intent,
              sensorReadingsSummary: "Voice activation triggered emergency protocol.",
              userFeedback: transcript
            });

            const audio = new Audio(audioResponse.audioDataUri);
            audio.play().catch(e => console.error("Audio playback failed", e));
          } catch (debriefError) {
            // Silently handle audio issues
          }
        }
      } catch (error) {
        // AI busy or network error
      }
    };

    recognitionRef.current.onend = () => {
      isStartedRef.current = false;
      setIsListening(false);
      onStatusChange?.(false);
      // Restart for Always-On
      setTimeout(startRecognition, 200);
    };

    recognitionRef.current.onerror = (event: any) => {
      // Silence expected errors
      const silentErrors = ['no-speech', 'audio-capture', 'aborted'];
      if (!silentErrors.includes(event.error)) {
        // Only log serious errors
        if (event.error !== 'not-allowed') {
           // No console logging to keep it clean
        }
      }
      
      if (event.error === 'not-allowed') {
        isStartedRef.current = false;
      }
    };

    startRecognition();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
        isStartedRef.current = false;
      }
    };
  }, [onStatusChange, onDispatch, toast]);

  return null;
};
