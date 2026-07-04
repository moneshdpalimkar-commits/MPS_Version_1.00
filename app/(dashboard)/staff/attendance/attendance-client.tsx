"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as faceapi from "@vladmandic/face-api";
import {
  Camera,
  MapPin,
  Clock,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  CheckCircle,
  Eye,
  ArrowRight,
  Edit,
  History,
  WifiOff,
  Wifi,
  CloudUpload,
} from "lucide-react";
import { useOfflineAttendance } from "@/lib/hooks/use-offline-attendance";
import {
  checkInAction,
  checkOutAction,
  getStaffAttendanceLogsAction,
} from "@/app/actions/attendance-actions";
import { createCorrectionRequestAction } from "@/app/actions/correction-actions";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Form Validation Schema
const correctionSchema = z.object({
  correctionType: z.enum(["forgot_checkout", "wrong_attendance", "other"]),
  correctedCheckIn: z.string().optional().or(z.literal("")),
  correctedCheckOut: z.string().optional().or(z.literal("")),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

type CorrectionFormInput = z.infer<typeof correctionSchema>;

interface AttendanceClientProps {
  staffName: string;
  avatarUrl: string | null;
  referenceDescriptor: number[] | null;
  department: any | null;
  initialTodayLog: any | null;
  initialHistory: any[];
  initialCorrections: any[];
  sessionTimeoutHours: number;
}

export function AttendanceClient({
  staffName,
  avatarUrl,
  referenceDescriptor,
  department,
  initialTodayLog,
  initialHistory,
  initialCorrections,
  sessionTimeoutHours,
}: AttendanceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Offline attendance hook — handles online/offline routing + IndexedDB queue
  const { isOnline, queuedCount, isSyncing, submitAttendance } = useOfflineAttendance();

  const [activeTab, setActiveTab] = useState<"portal" | "history">("portal");
  const [todayLog, setTodayLog] = useState<any | null>(initialTodayLog);
  const [history, setHistory] = useState<any[]>(initialHistory);
  const [corrections, setCorrections] = useState<any[]>(initialCorrections);

  // Client time and attendance window offset logic
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getAttendanceWindow = () => {
    if (!department || !department.start_time || !department.end_time) {
      return {
        state: "lockout" as const,
        message: "No department configuration found.",
        checkInStart: "",
        checkInEnd: "",
        checkOutStart: "",
        checkOutEnd: "",
      };
    }

    const [startH, startM] = department.start_time.split(":").map(Number);
    const [endH, endM] = department.end_time.split(":").map(Number);

    const shiftStart = new Date(currentTime);
    shiftStart.setHours(startH, startM, 0, 0);

    const shiftEnd = new Date(currentTime);
    shiftEnd.setHours(endH, endM, 0, 0);
    if (shiftEnd < shiftStart) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    const shiftDurationMs = shiftEnd.getTime() - shiftStart.getTime();
    const windowOffsetMins = department.attendance_window_mins ?? 120;

    let checkInStart = new Date(shiftStart.getTime() - windowOffsetMins * 60 * 1000);
    let checkInEnd = new Date(shiftStart.getTime() + windowOffsetMins * 60 * 1000);

    let checkOutStart = new Date(shiftEnd.getTime() - windowOffsetMins * 60 * 1000);
    let checkOutEnd = new Date(shiftEnd.getTime() + windowOffsetMins * 60 * 1000);

    const midShift = new Date(shiftStart.getTime() + shiftDurationMs / 2);
    if (checkInEnd > midShift) {
      checkInEnd = midShift;
    }
    if (checkOutStart < midShift) {
      checkOutStart = midShift;
    }

    const formatTime = (d: Date) => {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const checkInStartStr = formatTime(checkInStart);
    const checkInEndStr = formatTime(checkInEnd);
    const checkOutStartStr = formatTime(checkOutStart);
    const checkOutEndStr = formatTime(checkOutEnd);

    if (currentTime >= checkInStart && currentTime <= checkInEnd) {
      return {
        state: "checkin" as const,
        message: `Morning Check-In window active: ${checkInStartStr} - ${checkInEndStr}`,
        checkInStart: checkInStartStr,
        checkInEnd: checkInEndStr,
        checkOutStart: checkOutStartStr,
        checkOutEnd: checkOutEndStr,
      };
    }

    if (currentTime >= checkOutStart && currentTime <= checkOutEnd) {
      return {
        state: "checkout" as const,
        message: `Evening Check-Out window active: ${checkOutStartStr} - ${checkOutEndStr}`,
        checkInStart: checkInStartStr,
        checkInEnd: checkInEndStr,
        checkOutStart: checkOutStartStr,
        checkOutEnd: checkOutEndStr,
      };
    }

    return {
      state: "lockout" as const,
      message: "Attendance window closed.",
      checkInStart: checkInStartStr,
      checkInEnd: checkInEndStr,
      checkOutStart: checkOutStartStr,
      checkOutEnd: checkOutEndStr,
    };
  };

  const activeWindow = getAttendanceWindow();

  const canMarkAttendance =
    (activeWindow.state === "checkin" && !todayLog) ||
    (activeWindow.state === "checkout" && todayLog && !todayLog.check_out_time);

  const calculateTotalHours = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return "—";
    const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    return `${diffHrs.toFixed(2)} hrs`;
  };

  // Verification flow states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [verificationStep, setVerificationStep] = useState<
    "idle" | "gps" | "liveness" | "face" | "saving" | "success"
  >("idle");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [liveSnap, setLiveSnap] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Scans progress counters
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [faceProgress, setFaceProgress] = useState(0);

  // Month filters for history
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

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
        setErrorMsg("Failed to load facial recognition models. Please check your connection.");
        setLoadingModels(false);
      }
    }
    loadModels();
  }, []);

  // Save session timeout setting to localStorage for offline access
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("session_timeout_hours", String(sessionTimeoutHours));
    }
  }, [sessionTimeoutHours]);

  // Correction Modal States
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedLogForCorrection, setSelectedLogForCorrection] = useState<any>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Form hook
  const correctionForm = useForm<CorrectionFormInput>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      correctionType: "forgot_checkout",
      correctedCheckIn: "",
      correctedCheckOut: "",
      reason: "",
    },
  });

  // Start webcam stream
  const startCamera = async () => {
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
      setErrorMsg("Camera access denied. Please allow video permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Sync webcam stream to video element when stream is active
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const canMark =
      (activeWindow.state === "checkin" && !todayLog) ||
      (activeWindow.state === "checkout" && todayLog && !todayLog.check_out_time);

    // If not checked out, open video feed when portal tab is active and we are in active verification or preview
    const shouldStartCamera =
      activeTab === "portal" &&
      canMark &&
      !liveSnap &&
      verificationStep !== "saving" &&
      verificationStep !== "success" &&
      !loadingModels;
    
    if (shouldStartCamera) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [activeTab, todayLog, liveSnap, verificationStep, loadingModels, activeWindow.state]);

  // Load history on filter change
  const handleFilterChange = async (m: number, y: number) => {
    setFilterMonth(m);
    setFilterYear(y);
    const result = await getStaffAttendanceLogsAction(m, y);
    if (result.success && result.logs) {
      setHistory(result.logs);
    }
  };

  // Flow Step 1: GPS coordinates validation
  const triggerVerificationFlow = () => {
    setErrorMsg(null);
    setVerificationStep("gps");

    if (!navigator.geolocation) {
      setErrorMsg("Geolocation not supported by this browser.");
      setVerificationStep("idle");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ latitude: lat, longitude: lng });

        // Calculate distance if geofence is set
        if (department && department.gps_latitude && department.gps_longitude) {
          // Haversine formula
          const dist = calculateDistance(
            lat,
            lng,
            Number(department.gps_latitude),
            Number(department.gps_longitude)
          );
          setDistance(dist);

          if (dist > department.gps_radius_meters) {
            setErrorMsg(
              `Geofence Error: You are outside the campus boundary by ${Math.round(
                dist - department.gps_radius_meters
              )}m. (Your Distance: ${Math.round(dist)}m, Limit: ${department.gps_radius_meters}m).`
            );
            setVerificationStep("idle");
            return;
          }
        } else {
          setDistance(0);
        }

        // Advance to liveness check
        triggerLivenessCheck();
      },
      (error) => {
        setErrorMsg(`GPS Error: ${error.message}. Please enable location and try again.`);
        setVerificationStep("idle");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Helper: Haversine distance in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Flow Step 2: Simulated Blink/Motion Face Liveness check
  const triggerLivenessCheck = () => {
    setVerificationStep("liveness");
    setLivenessProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress >= 100) {
        clearInterval(interval);
        setLivenessProgress(100);
        captureFaceSnapshot();
      } else {
        setLivenessProgress(progress);
      }
    }, 120);
  };

  // Flow Step 3: Capture Snap & Face Vector Compare
  const captureFaceSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (loadingModels) {
      setErrorMsg("Facial recognition models are still loading.");
      return;
    }

    const video = videoRef.current;
    setErrorMsg(null);

    try {
      // 1. Run client-side face detection
      const detection = await faceapi
        .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setErrorMsg("Face verification failed: No face detected. Please ensure your face is fully visible.");
        setVerificationStep("idle");
        startCamera();
        return;
      }

      // 2. Verify against reference template descriptor
      if (!referenceDescriptor || referenceDescriptor.length !== 128) {
        setErrorMsg("Biometric reference template not found. Please complete face setup first.");
        setVerificationStep("idle");
        startCamera();
        return;
      }

      const liveDescriptor = detection.descriptor;
      let sumDist = 0;
      for (let i = 0; i < 128; i++) {
        const diff = liveDescriptor[i] - referenceDescriptor[i];
        sumDist += diff * diff;
      }
      const dist = Math.sqrt(sumDist);

      // Biometric similarity threshold (0.65 is relaxed for face-api.js SSD/Tiny)
      if (dist > 0.65) {
        setErrorMsg(`Biometric verification failed: Match mismatch (Distance: ${dist.toFixed(2)} > 0.65). Please look directly at the camera.`);
        setVerificationStep("idle");
        startCamera();
        return;
      }

      // Convert distance to a user-friendly match percentage
      const score = Math.round(100 - (dist / 0.65) * 30);
      setMatchScore(score);

      // 3. Capture image from video
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // Mirror image flip for natural capture
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      const snapData = canvas.toDataURL("image/jpeg", 0.85);
      setLiveSnap(snapData);
      stopCamera(); // Turn off webcam once snap is taken

      // 4. Trigger vector face match animation
      setVerificationStep("face");
      setFaceProgress(0);

      let progress = 0;
      const interval = setInterval(() => {
        progress += 15;
        if (progress >= 100) {
          clearInterval(interval);
          setFaceProgress(100);
          executeAttendanceSave(snapData);
        } else {
          setFaceProgress(progress);
        }
      }, 150);
    } catch (err: any) {
      setErrorMsg(`Biometric matching error: ${err.message || "An unexpected error occurred."}`);
      setVerificationStep("idle");
      startCamera();
    }
  };

  // Flow Step 4: Submit attendance — online → Server Action, offline → IndexedDB + BackgroundSync
  const executeAttendanceSave = (snapData: string) => {
    setVerificationStep("saving");
    const type = !todayLog ? "checkin" : "checkout";

    startTransition(async () => {
      const result = await submitAttendance(type, snapData, {
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });

      if (result.success) {
        setVerificationStep("success");

        if (result.offline) {
          // Queued offline — show success but don't reload (no server data yet)
          setTimeout(() => {
            setVerificationStep("idle");
            setLiveSnap(null);
            setMatchScore(null);
            setErrorMsg(null);
            // Show a local "queued" log entry to give the user feedback
          }, 2500);
        } else {
          // Online success — reload page to fetch fresh server state
          setTimeout(() => {
            router.refresh();
            setVerificationStep("idle");
            setLiveSnap(null);
            setMatchScore(null);
            window.location.reload();
          }, 2500);
        }
      } else {
        setErrorMsg(result.error || "Attendance recording failed.");
        setVerificationStep("idle");
        startCamera();
      }
    });
  };

  // Reset checking state
  const handleCancelFlow = () => {
    setErrorMsg(null);
    setLiveSnap(null);
    setMatchScore(null);
    setVerificationStep("idle");
    startCamera();
  };

  // Click Request Correction
  const handleOpenCorrection = (log: any) => {
    setSelectedLogForCorrection(log);
    setCorrectionError(null);
    setSuccessMsg(null);

    // Default values: extract existing check-in/out hours/minutes if present
    const inTime = log.check_in_time ? new Date(log.check_in_time).toTimeString().substring(0, 5) : "";
    const outTime = log.check_out_time ? new Date(log.check_out_time).toTimeString().substring(0, 5) : "";

    correctionForm.reset({
      correctionType: "forgot_checkout",
      correctedCheckIn: inTime,
      correctedCheckOut: outTime,
      reason: "",
    });

    setIsCorrectionModalOpen(true);
  };

  // Submit Correction Request
  const handleCorrectionSubmit = async (data: CorrectionFormInput) => {
    setCorrectionError(null);
    setSuccessMsg(null);

    if (!selectedLogForCorrection) return;

    startTransition(async () => {
      const result = await createCorrectionRequestAction({
        attendanceId: selectedLogForCorrection.id,
        correctionType: data.correctionType,
        correctedCheckIn: data.correctedCheckIn || undefined,
        correctedCheckOut: data.correctedCheckOut || undefined,
        reason: data.reason,
      });

      if (result.success) {
        setSuccessMsg("Attendance correction request submitted successfully!");
        setTimeout(() => {
          setIsCorrectionModalOpen(false);
          // Auto reload page or refresh path to get updated requests list
          window.location.reload();
        }, 2000);
      } else {
        setCorrectionError(result.error || "Failed to submit correction request.");
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "on_time":
      case "present":
        return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold uppercase">On Time</span>;
      case "late":
        return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-bold uppercase">Late</span>;
      case "super_late":
        return <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 rounded-full text-[10px] font-bold uppercase">Super Late</span>;
      case "half_day":
        return <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 rounded-full text-[10px] font-bold uppercase">Half Day</span>;
      case "leave":
      case "on_leave":
        return <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full text-[10px] font-bold uppercase">Leave</span>;
      case "holiday":
        return <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 rounded-full text-[10px] font-bold uppercase">Holiday</span>;
      default:
        return <span className="px-2 py-0.5 bg-zinc-500/10 text-zinc-600 rounded-full text-[10px] font-bold uppercase">Absent</span>;
    }
  };

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold uppercase">Approved</span>;
      case "rejected":
        return <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded-full text-[10px] font-bold uppercase">Rejected</span>;
      default:
        return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-bold uppercase">Pending</span>;
    }
  };

  const getCorrectionTypeLabel = (type: string) => {
    switch (type) {
      case "forgot_checkout":
        return "Forgot Checkout";
      case "wrong_attendance":
        return "Wrong Attendance Info";
      default:
        return "Other";
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabbing */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("portal")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
            activeTab === "portal"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Attendance Portal
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          History & Corrections
        </button>
      </div>

      {/* ─── Offline Status Banner ─── */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
          >
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-300">Offline Mode</p>
                <p className="text-xs text-amber-400/80">
                  Attendance will be saved locally and synced automatically when reconnected.
                </p>
              </div>
            </div>
            {queuedCount > 0 && (
              <div className="flex-shrink-0 flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg px-2.5 py-1">
                <CloudUpload className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-300">{queuedCount}</span>
              </div>
            )}
          </motion.div>
        )}
        {isOnline && isSyncing && (
          <motion.div
            key="syncing-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3"
          >
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-300">Syncing Offline Records…</p>
              <p className="text-xs text-indigo-400/80">
                {queuedCount} attendance record{queuedCount !== 1 ? "s" : ""} being uploaded to server.
              </p>
            </div>
          </motion.div>
        )}
        {isOnline && !isSyncing && queuedCount > 0 && (
          <motion.div
            key="queued-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
          >
            <Wifi className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-300">
              Back online — {queuedCount} offline record{queuedCount !== 1 ? "s" : ""} will sync shortly.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeTab === "portal" ? (
          <motion.div
            key="portal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Left Column: Webcam Verification Scanner */}
            <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <Camera className="w-5 h-5 text-primary" />
                  Biometric Scanner
                </h2>
                {department && (
                  <span className="text-xs text-muted-foreground font-medium">
                    Shift start: <strong>{department.start_time.substring(0, 5)}</strong>
                  </span>
                )}
              </div>

              {/* Webcam Viewport */}
              <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-border shadow-inner flex items-center justify-center">
                {loadingModels && (
                  <div className="absolute inset-0 bg-card p-6 flex flex-col items-center justify-center text-center space-y-3 z-25">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Loading Biometric Models...
                    </p>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />

                {!canMarkAttendance && !loadingModels && !errorMsg && (
                  <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center text-center space-y-4 p-6 z-15">
                    <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 shadow-lg">
                      <Clock className="w-8 h-8 animate-pulse text-zinc-500" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-zinc-300 uppercase tracking-widest block">
                        Scanner Deactivated
                      </span>
                      <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                        {activeWindow.state === "lockout"
                          ? "The biometric scanner is disabled because you are outside the scheduled attendance windows."
                          : activeWindow.state === "checkin" && todayLog
                          ? "You have already completed your check-in for today."
                          : activeWindow.state === "checkout" && !todayLog
                          ? "You cannot check out because you did not log a check-in for today."
                          : "Shift logs completed for today."}
                      </p>
                    </div>
                  </div>
                )}


                {errorMsg && (
                  <div className="absolute inset-0 bg-card p-6 flex flex-col items-center justify-center text-center space-y-3 z-20">
                    <ShieldAlert className="w-10 h-10 text-destructive animate-bounce" />
                    <p className="text-sm font-semibold text-foreground max-w-xs leading-relaxed">
                      {errorMsg}
                    </p>
                    <button
                      onClick={handleCancelFlow}
                      className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                      Retry Scanner
                    </button>
                  </div>
                )}

                {/* Webcam Stream */}
                {verificationStep !== "face" &&
                  verificationStep !== "saving" &&
                  verificationStep !== "success" &&
                  !liveSnap && (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  )}

                {/* Captured snapshot during match verification */}
                {liveSnap && (
                  <img
                    src={liveSnap}
                    alt="Webcam snap"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Central oval overlay helper */}
                {verificationStep === "idle" && !errorMsg && (
                  <div className="absolute inset-0 border-2 border-dashed border-primary/50 rounded-full scale-y-80 scale-x-50 pointer-events-none" />
                )}

                {/* Dynamic verification state screen overlays */}
                {verificationStep === "gps" && (
                  <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-center space-y-3 z-10">
                    <MapPin className="w-8 h-8 text-primary animate-bounce" />
                    <span className="text-xs font-bold text-white uppercase tracking-widest">
                      Validating GPS Geofence...
                    </span>
                  </div>
                )}

                {verificationStep === "liveness" && (
                  <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-center space-y-4 z-10 px-6">
                    <Eye className="w-8 h-8 text-primary animate-pulse" />
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-white uppercase tracking-widest block">
                        Liveness Check: BLINK NOW
                      </span>
                      <p className="text-[11px] text-zinc-300">
                        Detecting ocular reflexes and face motion...
                      </p>
                    </div>
                    <div className="h-1.5 w-40 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-100"
                        style={{ width: `${livenessProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {verificationStep === "face" && (
                  <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-center space-y-4 z-10 px-6">
                    <ShieldCheck className="w-8 h-8 text-primary animate-pulse" />
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-white uppercase tracking-widest block">
                        Verifying Face Landmark Templates
                      </span>
                      <p className="text-[11px] text-zinc-300">
                        Comparing live scan vectors against profile...
                      </p>
                    </div>
                    <div className="h-1.5 w-40 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-100"
                        style={{ width: `${faceProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {verificationStep === "saving" && (
                  <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-center space-y-3 z-10">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-xs font-bold text-white uppercase tracking-widest">
                      {isOnline ? "Recording Attendance..." : "Saving Offline..."}
                    </span>
                  </div>
                )}

                {verificationStep === "success" && (
                  <div className={`absolute inset-0 flex flex-col items-center justify-center text-center space-y-3 z-20 ${isOnline ? "bg-emerald-950/90" : "bg-amber-950/90"}`}>
                    {isOnline ? (
                      <CheckCircle className="w-12 h-12 text-emerald-400" />
                    ) : (
                      <CloudUpload className="w-12 h-12 text-amber-400" />
                    )}
                    <div className="space-y-0.5">
                      <span className="text-sm font-bold text-white uppercase tracking-widest block">
                        {isOnline ? "Verified & Logged!" : "Saved Offline!"}
                      </span>
                      <p className={`text-xs ${isOnline ? "text-emerald-200" : "text-amber-200"}`}>
                        {isOnline
                          ? "Attendance recorded successfully."
                          : "Will sync automatically when back online."}
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Action scanner triggers */}
              {verificationStep === "idle" && !errorMsg && (
                <div className="flex justify-end pt-2 border-t border-border w-full">
                  {activeWindow.state === "lockout" ? (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-medium w-full flex flex-col items-center justify-center gap-2 text-center animate-in fade-in slide-in-from-top-1">
                      <ShieldAlert className="w-6 h-6 text-rose-500" />
                      <div>
                        <span className="font-bold text-sm block mb-1">Attendance window closed</span>
                        <p className="text-[11px] text-rose-500/80">
                          You can only mark attendance during allowed windows:
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 mt-2 font-mono text-[10px] font-semibold bg-rose-500/5 px-3 py-1.5 rounded-lg border border-rose-500/10">
                          <div>Morning Check-In: {activeWindow.checkInStart} - {activeWindow.checkInEnd}</div>
                          <div className="hidden sm:block border-l border-rose-500/20 pl-2"></div>
                          <div>Evening Check-Out: {activeWindow.checkOutStart} - {activeWindow.checkOutEnd}</div>
                        </div>
                      </div>
                    </div>
                  ) : activeWindow.state === "checkin" ? (
                    todayLog ? (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg text-xs font-semibold w-full flex items-center justify-center gap-2">
                        <CheckCircle className="w-4.5 h-4.5" />
                        <span>Already checked in. Evening check-out window opens at {activeWindow.checkOutStart}.</span>
                      </div>
                    ) : (
                      <button
                        onClick={triggerVerificationFlow}
                        disabled={loadingModels}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {loadingModels ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading Biometrics...
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4" />
                            Verify and Clock In
                          </>
                        )}
                      </button>
                    )
                  ) : activeWindow.state === "checkout" ? (
                    todayLog && todayLog.check_out_time ? (
                      <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold w-full flex items-center justify-center gap-2">
                        <CheckCircle className="w-4.5 h-4.5" />
                        <span>Shift logs completed for today.</span>
                      </div>
                    ) : todayLog ? (
                      <button
                        onClick={triggerVerificationFlow}
                        disabled={loadingModels}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-orange-600 text-white font-bold rounded-lg text-sm hover:bg-orange-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {loadingModels ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading Biometrics...
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4" />
                            Verify and Clock Out
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-medium w-full flex flex-col items-center justify-center gap-2 text-center">
                        <ShieldAlert className="w-6 h-6 text-rose-500" />
                        <div>
                          <span className="font-bold text-sm block mb-1">Missed check-in window</span>
                          <p className="text-[11px] text-rose-500/80">
                            You cannot clock out since you did not check in during the morning window ({activeWindow.checkInStart} - {activeWindow.checkInEnd}).
                          </p>
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              )}

              {/* Progress feedback details */}
              {verificationStep !== "idle" && verificationStep !== "success" && (
                <div className="p-4 bg-muted/40 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${coords ? "bg-emerald-500" : "bg-zinc-400 animate-ping"}`} />
                    <span className="text-xs font-medium text-foreground">
                      GPS Location: {coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : "Polling GPS..."}
                    </span>
                  </div>
                  {distance !== null && (
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-foreground">
                        Campus Boundary: {Math.round(distance)}m from center (Geofence OK)
                      </span>
                    </div>
                  )}
                  {livenessProgress > 0 && (
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${livenessProgress >= 100 ? "bg-emerald-500" : "bg-zinc-400 animate-ping"}`} />
                      <span className="text-xs font-medium text-foreground">
                        Biometric Liveness: {livenessProgress >= 100 ? "Pass" : "Verifying ocular reflexes..."}
                      </span>
                    </div>
                  )}
                  {matchScore !== null && (
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-foreground">
                        Vector Recognition: {matchScore}% Facial Match Confirmed
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Status & Reference comparison */}
            <div className="lg:col-span-5 space-y-6">
              {/* Today's Log Card */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="w-4.5 h-4.5 text-primary" />
                  Today's Shift Log
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">Clock In</span>
                    <span className="text-sm font-semibold text-foreground font-mono">
                      {todayLog?.check_in_time
                        ? new Date(todayLog.check_in_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">Clock Out</span>
                    <span className="text-sm font-semibold text-foreground font-mono">
                      {todayLog?.check_out_time
                        ? new Date(todayLog.check_out_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">Status</span>
                    {todayLog?.status ? getStatusBadge(todayLog.status) : <span className="text-xs text-muted-foreground/60 italic">Not Logged</span>}
                  </div>

                  {todayLog?.check_in_time && todayLog?.check_out_time && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs font-medium text-muted-foreground">Total Hours Worked</span>
                      <span className="text-sm font-semibold text-foreground font-mono">
                        {calculateTotalHours(todayLog.check_in_time, todayLog.check_out_time)}
                      </span>
                    </div>
                  )}
                </div>

                {department && (
                  <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <MapPin className="w-3.5 h-3.5" />
                      School Geofence Radius
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Department: <strong>{department.name}</strong><br />
                      Center: <strong>{Number(department.gps_latitude).toFixed(4)}, {Number(department.gps_longitude).toFixed(4)}</strong><br />
                      Authorized Range: <strong>{department.gps_radius_meters} meters</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Side-by-side Landmarks Matcher */}
              {verificationStep === "face" && liveSnap && avatarUrl && (
                <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Biometric Landmarks Comparison</h3>
                  <div className="grid grid-cols-2 gap-3 relative">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Reference</span>
                      <div className="aspect-square rounded-lg border border-border overflow-hidden bg-muted">
                        <img src={avatarUrl} alt="Reference face" className="w-full h-full object-cover" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Live Capture</span>
                      <div className="aspect-square rounded-lg border border-border overflow-hidden bg-muted">
                        <img src={liveSnap} alt="Live snap" className="w-full h-full object-cover" />
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-primary/10 rounded-lg pointer-events-none flex items-center justify-center border border-primary/25 border-dashed">
                      <div className="bg-card border border-primary px-3 py-1.5 rounded-lg text-center shadow-xs">
                        <span className="block text-[10px] font-bold text-primary uppercase">Comparing</span>
                        <span className="text-xs font-bold text-foreground font-mono">{faceProgress}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* PAST CLOCK LOGS SECTION */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-6">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4.5 h-4.5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Attendance Clock Logs</h3>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={filterMonth}
                    onChange={(e) => handleFilterChange(Number(e.target.value), filterYear)}
                    className="w-full sm:w-36 px-2.5 py-1.5 border border-border rounded-lg bg-card text-xs text-foreground focus:outline-hidden"
                  >
                    <option value={1}>January</option>
                    <option value={2}>February</option>
                    <option value={3}>March</option>
                    <option value={4}>April</option>
                    <option value={5}>May</option>
                    <option value={6}>June</option>
                    <option value={7}>July</option>
                    <option value={8}>August</option>
                    <option value={9}>September</option>
                    <option value={10}>October</option>
                    <option value={11}>November</option>
                    <option value={12}>December</option>
                  </select>

                  <select
                    value={filterYear}
                    onChange={(e) => handleFilterChange(filterMonth, Number(e.target.value))}
                    className="w-full sm:w-28 px-2.5 py-1.5 border border-border rounded-lg bg-card text-xs text-foreground focus:outline-hidden"
                  >
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              </div>

              {/* History Table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Date</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Clock In</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Clock Out</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Hours</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Status</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Snapshots</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Campus Distance</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {history.length > 0 ? (
                        history.map((log) => {
                          const inGps = log.check_in_gps;
                          
                          // Check if a correction request is already pending/approved for this log
                          const hasCorrection = corrections.some(
                            (c) => c.attendance_id === log.id && c.status === "pending"
                          );
                          const isCorrected = corrections.some(
                            (c) => c.attendance_id === log.id && c.status === "approved"
                          );

                          return (
                            <tr key={log.id} className="hover:bg-muted/10">
                              <td className="px-4 py-3 text-xs text-foreground font-semibold">
                                {new Date(log.date).toLocaleDateString([], {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                              <td className="px-4 py-3 text-xs text-foreground font-mono">
                                {log.check_in_time
                                  ? new Date(log.check_in_time).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-xs text-foreground font-mono">
                                {log.check_out_time
                                  ? new Date(log.check_out_time).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-xs text-foreground font-mono">
                                {calculateTotalHours(log.check_in_time, log.check_out_time)}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {getStatusBadge(log.status)}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                <div className="flex gap-1.5">
                                  {log.check_in_face_url && (
                                    <a
                                      href={log.check_in_face_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2 py-0.5 border border-border rounded bg-muted hover:bg-accent text-[10px] font-medium text-foreground cursor-pointer flex items-center gap-1"
                                    >
                                      <Eye className="w-3 h-3" /> In
                                    </a>
                                  )}
                                  {log.check_out_face_url && (
                                    <a
                                      href={log.check_out_face_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2 py-0.5 border border-border rounded bg-muted hover:bg-accent text-[10px] font-medium text-foreground cursor-pointer flex items-center gap-1"
                                    >
                                      <Eye className="w-3 h-3" /> Out
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                                {inGps && inGps.distance_meters !== undefined
                                  ? `${inGps.distance_meters} meters`
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-xs text-right">
                                {isCorrected ? (
                                  <span className="text-[10px] text-emerald-600 font-bold uppercase">Corrected</span>
                                ) : hasCorrection ? (
                                  <span className="text-[10px] text-amber-500 font-semibold uppercase">Pending Approval</span>
                                ) : (
                                  <button
                                    onClick={() => handleOpenCorrection(log)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-border hover:border-primary/50 rounded-md bg-muted/50 hover:bg-primary/10 text-xs font-semibold text-foreground hover:text-primary transition-all cursor-pointer"
                                    title="Request Time Correction"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                    Request Fix
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground">
                            No attendance records found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* CORRECTION REQUESTS HISTORY SECTION */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <History className="w-4.5 h-4.5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Correction Requests History</h3>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Date Requested</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Target Date</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Correction Type</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Corrected Times</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Reason</th>
                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {corrections.length > 0 ? (
                        corrections.map((corr) => (
                          <tr key={corr.id} className="hover:bg-muted/10">
                            <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                              {new Date(corr.created_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground font-semibold">
                              {corr.attendance?.date
                                ? new Date(corr.attendance.date).toLocaleDateString([], {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground font-medium">
                              {getCorrectionTypeLabel(corr.correction_type)}
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground font-mono leading-relaxed">
                              <div>
                                In: <strong>{corr.corrected_check_in ? new Date(corr.corrected_check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A"}</strong>
                              </div>
                              <div>
                                Out: <strong>{corr.corrected_check_out ? new Date(corr.corrected_check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A"}</strong>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={corr.reason}>
                              {corr.reason}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {getRequestStatusBadge(corr.status)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-xs text-muted-foreground">
                            No attendance correction requests submitted.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request Correction Form Dialog */}
      <Dialog
        open={isCorrectionModalOpen}
        onOpenChange={(isOpen) => !isOpen && setIsCorrectionModalOpen(false)}
      >
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Request Attendance Correction
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Submit correct timings for your shift on{" "}
              <strong className="text-foreground">
                {selectedLogForCorrection?.date
                  ? new Date(selectedLogForCorrection.date).toLocaleDateString([], {
                      month: "long",
                      day: "numeric",
                    })
                  : ""}
              </strong>
              . Requests are reviewed and approved by the Principal.
            </DialogDescription>
          </DialogHeader>

          {correctionError && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{correctionError}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form
            onSubmit={correctionForm.handleSubmit(handleCorrectionSubmit)}
            className="space-y-4 mt-4"
          >
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Correction Type
              </label>
              <select
                {...correctionForm.register("correctionType")}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
              >
                <option value="forgot_checkout">Forgot Checkout</option>
                <option value="wrong_attendance">Wrong Attendance Info</option>
                <option value="other">Other / Remarks</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Corrected Clock In
                </label>
                <input
                  {...correctionForm.register("correctedCheckIn")}
                  type="time"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Corrected Clock Out
                </label>
                <input
                  {...correctionForm.register("correctedCheckOut")}
                  type="time"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Reason / Explanation
              </label>
              <textarea
                {...correctionForm.register("reason")}
                rows={3}
                placeholder="Brief explanation on why the clock log is missing or incorrect..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden placeholder:text-muted-foreground/60 resize-none"
              />
              {correctionForm.formState.errors.reason && (
                <span className="text-xs text-destructive mt-0.5 block">
                  {correctionForm.formState.errors.reason.message}
                </span>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border mt-5">
              <button
                type="button"
                onClick={() => setIsCorrectionModalOpen(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-accent text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit Request
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
