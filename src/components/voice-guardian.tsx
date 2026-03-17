
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
          // Ignore "already started" errors
          if (!(e instanceof Error && e.message.includes('already started'))) {
             console.warn('Recognition start failed:', e);
          }
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
          onDispatch?.(result.intent);
          
          // Play audio feedback
          try {
            const audioResponse = await postIncidentDebrief({
              incidentType: result.intent,
              sensorReadingsSummary: "Voice activation triggered emergency protocol.",
              userFeedback: transcript
            });

            const audio = new Audio(audioResponse.audioDataUri);
            audio.play().catch(e => console.error("Audio playback failed", e));
          } catch (debriefError) {
            // Silently handle audio quota issues
          }

          toast({
            title: result.feedbackMessage.split('•')[0].trim(),
            description: result.feedbackMessage,
          });
        }
      } catch (error) {
        // GenAI quota or processing error
      }
    };

    recognitionRef.current.onend = () => {
      isStartedRef.current = false;
      setIsListening(false);
      onStatusChange?.(false);
      // Automatically restart for "Always On"
      setTimeout(startRecognition, 100);
    };

    recognitionRef.current.onerror = (event: any) => {
      // "no-speech" is not an actual error, just silence. 
      // "aborted" and "audio-capture" are also common in dev environments.
      const silentErrors = ['no-speech', 'audio-capture', 'aborted'];
      if (!silentErrors.includes(event.error)) {
        console.error('Speech recognition error:', event.error);
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
