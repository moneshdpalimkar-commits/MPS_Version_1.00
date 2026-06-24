"use client";

import React, { useState, useEffect } from "react";
import { RoleGuard } from "@/components/shared/role-guard";
import { Settings, Save, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { getSystemSettingsAction, updateSystemSettingsAction } from "@/app/actions/settings-actions";

export default function SuperadminSettings() {
  const [gpsRadius, setGpsRadius] = useState("150");
  const [sessionTimeout, setSessionTimeout] = useState("24");
  const [backupPeriod, setBackupPeriod] = useState("daily");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      const res = await getSystemSettingsAction();
      setIsLoading(false);
      if (res.success && res.settings) {
        setGpsRadius(String(res.settings.gps_radius_meters));
        setSessionTimeout(String(res.settings.session_timeout_hours));
        setBackupPeriod(res.settings.backup_interval);
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsSuccess(false);
    setErrorMsg(null);

    const result = await updateSystemSettingsAction({
      gpsRadiusMeters: Number(gpsRadius),
      sessionTimeoutHours: Number(sessionTimeout),
      backupInterval: backupPeriod,
    });

    setIsLoading(false);
    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } else {
      setErrorMsg(result.error || "Failed to update settings.");
    }
  };

  return (
    <RoleGuard allowedRoles={["superadmin"]}>
      <div className="space-y-6 select-none">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            System Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure global SaaS configurations, GPS validation parameters, and database backup targets.
          </p>
        </div>

        {/* Configurations Form */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs max-w-xl">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">
              Global Threshold Configs
            </h2>
          </div>

          {errorMsg && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-xs font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errorMsg}
            </div>
          )}

          {isSuccess && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Settings updated successfully!
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                GPS Verification Radius (Meters)
              </label>
              <input
                type="number"
                required
                min="10"
                max="1000"
                value={gpsRadius}
                onChange={(e) => setGpsRadius(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
              />
              <span className="block text-[10px] text-muted-foreground mt-1">
                Maximum allowable distance between check-in location and school coordinates.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Offline Logs Expiry (Hours)
              </label>
              <input
                type="number"
                required
                min="1"
                max="72"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
              />
              <span className="block text-[10px] text-muted-foreground mt-1">
                Offline check-in logs auto-expire from PWA local storage after this period.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Database Backup Interval
              </label>
              <select
                value={backupPeriod}
                onChange={(e) => setBackupPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
              >
                <option value="hourly">Hourly Snapshots</option>
                <option value="daily">Daily Incremental</option>
                <option value="weekly">Weekly Full</option>
              </select>
              <span className="block text-[10px] text-muted-foreground mt-1">
                Trigger schedule for automated PostgreSQL snapshots.
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </RoleGuard>
  );
}
