"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  UserCheck,
  RefreshCw,
  Lock,
} from "lucide-react";
import {
  registerFaceTemplateAction,
  completeFaceRegistrationAction,
} from "@/app/actions/biometric-actions";
import * as faceapi from "@vladmandic/face-api";

interface WizardClientProps {
  firstName: string;
  initialAttempts: number;
}

type Pose = "front" | "left" | "right" | "up" | "down";

const POSES: { id: Pose; label: string; instruction: string }[] = [
  {
    id: "front",
    label: "Front View",
    instruction: "Look directly at the camera and align your face inside the central oval frame.",
  },
  {
    id: "left",
    label: "Left Profile",
    instruction: "Slowly turn your head to the Left. Look at the left side arrow.",
  },
  {
    id: "right",
    label: "Right Profile",
    instruction: "Slowly turn your head to the Right. Look at the right side arrow.",
  },
  {
    id: "up",
    label: "Look Up",
    instruction: "Slightly tilt your head Upwards. Look at the top arrow.",
  },
  {
    id: "down",
    label: "Look Down",
    instruction: "Slightly tilt your head Downwards. Look at the bottom arrow.",
  },
];

export function WizardClient({ firstName, initialAttempts }: WizardClientProps) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(initialAttempts);
  const [currentStep, setCurrentStep] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [templatesCount, setTemplatesCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);

  // Load face-api models on mount
  useEffect(() => {
    async function loadModels() {
      try {
        setLoadingModels(true);
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setLoadingModels(false);
      } catch (err) {
        console.error("Error loading face-api models:", err);
        setErrorMsg("Failed to load facial recognition models. Please check your network connection.");
        setLoadingModels(false);
      }
    }
    loadModels();
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activePose = POSES[currentStep];

  // Start webcam
  const startCamera = async () => {
    setErrorMsg(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setErrorMsg("Unable to access camera. Please allow camera permissions and try again.");
    }
  };

  // Sync webcam stream to video element when stream is active
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (attempts < 5 && !isCompleted && !loadingModels) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [attempts, isCompleted, loadingModels]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Trigger scan capture
  const handleScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (loadingModels) {
      setErrorMsg("Facial recognition models are still loading. Please wait.");
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setErrorMsg(null);

    // Scan progress animation (1.5 seconds)
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 120);

    try {
      const video = videoRef.current;
      // 1. Perform client-side face detection & descriptor extraction
      const detection = await faceapi
        .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        clearInterval(interval);
        setIsScanning(false);
        setErrorMsg("No face detected. Please ensure your face is fully visible in the frame and well-lit.");
        return;
      }

      // Convert Float32Array descriptor to regular array
      const descriptorArray = Array.from(detection.descriptor);

      // Wait for scanning animation to complete naturally
      await new Promise((resolve) => setTimeout(resolve, 1500));
      clearInterval(interval);
      setScanProgress(100);

      // 2. Capture image from video
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        // Mirror flip for natural webcam view
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Reset scale
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      const base64Image = canvas.toDataURL("image/jpeg", 0.85);

      // 3. Call server action to save template
      const result = await registerFaceTemplateAction({
        pose: activePose.id,
        base64Image,
        descriptor: descriptorArray,
      });

      setIsScanning(false);

      if (result.success) {
        setTemplatesCount(result.registeredCount || 0);
        if (result.allCompleted) {
          // Complete registration successfully
          setIsSaving(true);
          const completeResult = await completeFaceRegistrationAction(true);
          setIsSaving(false);
          if (completeResult.success) {
            setIsCompleted(true);
            if (stream) {
              stream.getTracks().forEach((track) => track.stop());
              setStream(null);
            }
          } else {
            setErrorMsg(completeResult.error || "Failed to finalize registration.");
          }
        } else {
          // Move to next pose
          setCurrentStep((prev) => prev + 1);
        }
      } else {
        setErrorMsg(result.error || "Failed to register pose.");
      }
    } catch (err: any) {
      clearInterval(interval);
      setIsScanning(false);
      setErrorMsg(`Biometric error: ${err.message || "An unexpected error occurred during scan."}`);
    }
  };

  // Simulate a failed attempt
  const handleSimulateFail = async () => {
    setErrorMsg(null);
    setIsSaving(true);
    const result = await completeFaceRegistrationAction(false);
    setIsSaving(false);

    if (result.success) {
      setAttempts(result.attempts || 0);
      if (result.locked) {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          setStream(null);
        }
      } else {
        alert(`Failed attempt registered. ${5 - (result.attempts || 0)} attempts remaining.`);
      }
    } else {
      setErrorMsg(result.error || "Failed to log attempt.");
    }
  };

  // Lock Screen View
  if (attempts >= 5) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-6 shadow-sm max-w-md mx-auto">
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Face Biometrics Locked</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Hey <strong className="text-foreground">{firstName}</strong>, you have exceeded the maximum allowed face registration attempts ({attempts}/5).
          </p>
          <div className="p-3.5 bg-destructive/15 text-destructive rounded-xl text-xs font-semibold flex items-start gap-2.5 text-left mt-2">
            <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
            <span>
              Your profile has been locked to prevent fraud. Please contact your school's Principal to trigger a biometrics reset.
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push("/auth/login")}
          className="w-full py-2.5 bg-muted text-foreground hover:bg-muted/80 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
        >
          Return to Login
        </button>
      </div>
    );
  }

  // Success View
  if (isCompleted) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-6 shadow-sm max-w-md mx-auto">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Registration Complete!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your face biometrics have been registered successfully across all 5 reference angles.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            You can now use the check-in portal to log daily attendance.
          </p>
        </div>
        <button
          onClick={() => {
            router.push("/staff");
            router.refresh();
          }}
          className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <UserCheck className="w-4 h-4" />
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center max-w-md mx-auto space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Face Setup Wizard
        </h1>
        <p className="text-sm text-muted-foreground">
          Hi {firstName}, configure your biometric references to secure your attendance logs.
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-xs font-bold mt-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          Attempts remaining: {5 - attempts} of 5
        </div>
      </div>

      {/* Main wizard card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        
        {/* Step progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
            <span>Progress: Pose {currentStep + 1} of 5</span>
            <span className="text-primary font-mono">{Math.round((currentStep / 5) * 100)}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / 5) * 100}%` }}
              className="h-full bg-primary"
            />
          </div>
        </div>

        {/* Current pose instructions */}
        <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1">
          <span className="text-xs font-bold text-primary tracking-wide uppercase">
            Current Step: {activePose.label}
          </span>
          <p className="text-sm text-foreground">
            {activePose.instruction}
          </p>
        </div>

        {/* Webcam feed wrapper */}
        <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-border shadow-inner flex items-center justify-center">
          {loadingModels && (
            <div className="absolute inset-0 bg-card p-6 flex flex-col items-center justify-center text-center space-y-3 z-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                Loading Biometric Models...
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 bg-card p-6 flex flex-col items-center justify-center text-center space-y-4 z-10">
              <ShieldAlert className="w-10 h-10 text-destructive" />
              <p className="text-sm text-foreground max-w-xs font-semibold leading-relaxed">
                {errorMsg}
              </p>
              <button
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera Connection
              </button>
            </div>
          )}

          {/* Hidden canvas for image capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Video stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />

          {/* Scanner overlays */}
          {!errorMsg && (
            <>
              {/* Central Oval Frame for Front */}
              {activePose.id === "front" && (
                <div className="absolute inset-0 border-[3px] border-dashed border-primary/40 rounded-full scale-y-80 scale-x-50 pointer-events-none" />
              )}

              {/* Angle Direction arrow overlays */}
              {activePose.id === "left" && (
                <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center animate-pulse">
                  <span className="text-2xl text-primary font-bold">←</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Turn Left</span>
                </div>
              )}
              {activePose.id === "right" && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center animate-pulse">
                  <span className="text-2xl text-primary font-bold">→</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Turn Right</span>
                </div>
              )}
              {activePose.id === "up" && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center animate-pulse">
                  <span className="text-2xl text-primary font-bold">↑</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Look Up</span>
                </div>
              )}
              {activePose.id === "down" && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center animate-pulse">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Look Down</span>
                  <span className="text-2xl text-primary font-bold">↓</span>
                </div>
              )}

              {/* Scanning Radar Line */}
              {isScanning && (
                <motion.div
                  initial={{ top: "0%" }}
                  animate={{ top: "100%" }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="absolute left-0 right-0 h-0.5 bg-primary/80 shadow-[0_0_12px_#3b82f6] z-10"
                />
              )}

              {/* Processing scanner delay */}
              {isScanning && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center space-y-2">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-xs font-bold text-white uppercase tracking-widest">
                    Analyzing Pose ({scanProgress}%)
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Buttons Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSimulateFail}
            className="w-full sm:w-auto px-4 py-2 border border-border text-xs font-bold rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
            title="Log a failed scanning attempt (locks profile at 5)"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
            ) : (
              "Simulate Fail Attempt"
            )}
          </button>

          <button
            onClick={handleScan}
            disabled={isScanning || !!errorMsg || isSaving || loadingModels}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning Poses...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Capture Reference Poses
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
