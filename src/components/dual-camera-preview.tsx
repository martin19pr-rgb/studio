"use client";

import React, { useEffect, useRef, useState } from 'react';
import { GlassCard } from './glass-card';
import { Camera, Video, ScanEye, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const DualCameraPreview = () => {
  const roadVideoRef = useRef<HTMLVideoElement>(null);
  const cabinVideoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const startCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        // Attempt to get environment (road) camera
        const roadStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (roadVideoRef.current) roadVideoRef.current.srcObject = roadStream;

        // Attempt to get user (cabin) camera
        // Note: Some browsers/devices might only allow one camera at a time via getUserMedia
        // This implementation tries to handle both.
        try {
          const cabinStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' }
          });
          if (cabinVideoRef.current) cabinVideoRef.current.srcObject = cabinStream;
        } catch (e) {
          console.warn('Cabin camera failed - might be limited to one stream:', e);
        }

        setHasPermission(true);
      } catch (error) {
        console.error('Error accessing cameras:', error);
        setHasPermission(false);
      }
    };

    startCameras();

    return () => {
      // Cleanup streams
      [roadVideoRef, cabinVideoRef].forEach(ref => {
        if (ref.current?.srcObject) {
          (ref.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        }
      });
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 w-full">
      {hasPermission === false && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Camera Access Required</AlertTitle>
          <AlertDescription>
            Please allow camera access in your browser settings to enable continuous protection.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard className="relative overflow-hidden aspect-video p-0 group">
          <video 
            ref={roadVideoRef} 
            className="w-full h-full object-cover opacity-80" 
            autoPlay 
            muted 
            playsInline 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-primary/20 backdrop-blur-md px-3 py-1 rounded-full border border-primary/30">
            <Video className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Road • Live Protection</span>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
            <div>
              <p className="text-[10px] text-white/50 uppercase tracking-tighter">Status</p>
              <p className="text-sm font-headline text-white font-medium">Recording continuously...</p>
            </div>
            <div className="flex items-center gap-1 text-primary">
              <ScanEye className="w-4 h-4 animate-pulse" />
              <span className="text-[10px] font-bold uppercase">AI Hazard Scan</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="relative overflow-hidden aspect-video p-0 group">
          <video 
            ref={cabinVideoRef} 
            className="w-full h-full object-cover opacity-80" 
            autoPlay 
            muted 
            playsInline 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-accent/20 backdrop-blur-md px-3 py-1 rounded-full border border-accent/30">
            <Camera className="w-4 h-4 text-accent" />
            <span className="text-[10px] font-bold text-accent tracking-widest uppercase">Cabin • Live Monitoring</span>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[10px] text-white/50 uppercase tracking-tighter">Guardian Mode</p>
            <p className="text-sm font-headline text-white font-medium">Occupant status: Secured</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
