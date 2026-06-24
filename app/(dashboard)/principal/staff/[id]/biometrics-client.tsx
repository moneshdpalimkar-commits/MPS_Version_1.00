"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RefreshCw,
  Eye,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { resetFaceBiometricsAction } from "@/app/actions/biometric-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BiometricsClientProps {
  staffId: string;
  faceRegistered: boolean;
  attempts: number;
  templates: any[];
}

export function BiometricsClient({
  staffId,
  faceRegistered,
  attempts,
  templates,
}: BiometricsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleReset = () => {
    if (
      confirm(
        "Are you sure you want to RESET this staff member's face biometrics? This will delete all 5 reference templates and force them to complete the Face Setup Wizard upon their next login."
      )
    ) {
      setErrorMsg(null);
      startTransition(async () => {
        const result = await resetFaceBiometricsAction(staffId);
        if (result.success) {
          router.refresh();
        } else {
          setErrorMsg(result.error || "Failed to reset face biometrics.");
        }
      });
    }
  };

  const getPoseLabel = (pose: string) => {
    switch (pose) {
      case "front":
        return "Front View";
      case "left":
        return "Left Profile";
      case "right":
        return "Right Profile";
      case "up":
        return "Look Up";
      case "down":
        return "Look Down";
      default:
        return pose;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-primary" />
          Biometric Settings & Registered Poses
        </h2>

        {/* Action Button */}
        {(faceRegistered || attempts > 0) && (
          <button
            onClick={handleReset}
            disabled={isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-destructive/20 hover:border-destructive text-destructive bg-destructive/5 hover:bg-destructive/10 text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Reset Biometrics Profile
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-destructive/15 text-destructive rounded-xl text-xs font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Status Indicators */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 bg-muted/30 border border-border rounded-xl flex items-start gap-3">
          {faceRegistered ? (
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0 animate-pulse">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
          )}
          <div>
            <span className="block text-[10px] font-bold text-muted-foreground uppercase">Biometric Status</span>
            <span className="text-sm font-bold text-foreground">
              {faceRegistered ? "Registered & Verified" : "Not Registered"}
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {faceRegistered
                ? "This staff member can perform geofenced biometric check-ins."
                : "Staff will be forced to register their face upon their next login."}
            </p>
          </div>
        </div>

        <div className="p-4 bg-muted/30 border border-border rounded-xl flex items-start gap-3">
          {attempts >= 5 ? (
            <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center flex-shrink-0">
              <Lock className="w-4.5 h-4.5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-500/10 text-muted-foreground flex items-center justify-center flex-shrink-0">
              <Camera className="w-4.5 h-4.5" />
            </div>
          )}
          <div>
            <span className="block text-[10px] font-bold text-muted-foreground uppercase">Registration Locks</span>
            <span className="text-sm font-bold text-foreground">
              {attempts >= 5 ? "Locked Out (Attempts Expired)" : `${attempts} / 5 Attempts logged`}
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {attempts >= 5
                ? "This user has failed registration 5 times. Click 'Reset Biometrics Profile' above to unlock."
                : "A maximum of 5 attempts is allowed before biometrics lock."}
            </p>
          </div>
        </div>
      </div>

      {/* Templates view */}
      {faceRegistered && templates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Registered reference poses</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {templates.map((temp) => (
              <div
                key={temp.id}
                className="border border-border rounded-xl p-3 bg-muted/20 text-center space-y-2.5 relative group overflow-hidden"
              >
                <span className="block text-[10px] font-bold text-foreground uppercase">
                  {getPoseLabel(temp.pose)}
                </span>
                <div className="aspect-square rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center relative">
                  <img
                    src={temp.image_url}
                    alt={temp.pose}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setPreviewUrl(temp.image_url)}
                    className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-bold gap-1 text-[9px] uppercase tracking-wider"
                  >
                    <Eye className="w-3 h-3" /> Zoom
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo Zoom Modal */}
      <Dialog open={previewUrl !== null} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-xs w-full bg-card border border-border rounded-xl p-4">
          <DialogHeader>
            <DialogTitle className="text-xs font-bold text-foreground uppercase tracking-wider">Reference Pose Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="aspect-square rounded-lg overflow-hidden border border-border bg-black mt-2">
              <img src={previewUrl} alt="Zoom preview" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-border mt-3">
            <button
              onClick={() => setPreviewUrl(null)}
              className="px-4 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
