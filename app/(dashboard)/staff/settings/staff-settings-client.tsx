"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Heart,
  ShieldAlert,
  Loader2,
  Save,
  CheckCircle2,
  Calendar,
  Contact,
  Fingerprint,
  BellRing,
  Lock,
  Smartphone,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffSettingsClientProps {
  initialStaffData: any;
}

export function StaffSettingsClient({ initialStaffData }: StaffSettingsClientProps) {
  // Sandbox fallback
  const staff = initialStaffData || {
    employee_id: "MPS_001",
    first_name: "Monesh",
    last_name: "Palimkar",
    email: "moneshpalimkar@gmail.com",
    phone: "8600510958",
    staff_role: "teaching",
    designation: "Mathematics Head",
    blood_group: "A+",
    emergency_contact: "7709586644",
    address: "Nanded, Maharashtra",
    face_registered: true,
    schools: { name: "Model Public School" },
    departments: { name: "Science and Mathematics" },
    join_date: "2026-06-11",
  };

  // State
  const [phone, setPhone] = useState(staff.phone || "");
  const [emergencyContact, setEmergencyContact] = useState(staff.emergency_contact || "");
  const [address, setAddress] = useState(staff.address || "");
  const [bloodGroup, setBloodGroup] = useState(staff.blood_group || "");
  
  // Preference States (Mock Toggles)
  const [prefPayroll, setPrefPayroll] = useState(true);
  const [prefAnnouncements, setPrefAnnouncements] = useState(true);
  const [prefBiometrics, setPrefBiometrics] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect standalone mode
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect iOS Device
    const ua = window.navigator.userAgent;
    const iosDevice = /iphone|ipad|ipod/i.test(ua);
    setIsIOS(iosDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setIsStandalone(true);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsStandalone(true);
    } else {
      setIsInstalling(false);
    }
    setDeferredPrompt(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setIsSuccess(false);

    // Mock API Save delay
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    }, 1200);
  };

  const initials = `${staff.first_name?.[0] || ""}${staff.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div className="space-y-6 select-none animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Account Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          View your employment details and configure contact information and preferences.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Left Card - Profile Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-xs flex flex-col items-center text-center relative overflow-hidden">
            {/* Background Accent Gradients */}
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-primary/10 to-indigo-500/10 dark:from-primary/20 dark:to-indigo-500/20" />
            
            {/* Profile Avatar */}
            <div className="relative mt-8 mb-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-4 border-card flex items-center justify-center text-xl font-bold text-primary shadow-xs">
                {initials}
              </div>
            </div>

            {/* Name & Title */}
            <h2 className="font-bold text-base text-foreground leading-tight">
              {staff.first_name} {staff.last_name}
            </h2>
            <span className="text-xs font-semibold text-primary mt-1.5 px-2.5 py-0.5 rounded-full bg-primary/10">
              {staff.designation || "Staff Member"}
            </span>
            <p className="text-xs text-muted-foreground mt-2 font-medium">
              {staff.departments?.name || "No Department Assigned"}
            </p>
            <p className="text-[11px] text-muted-foreground font-bold mt-1">
              {staff.schools?.name || "MPS Portal"}
            </p>

            <hr className="w-full border-border my-5" />

            {/* General Employment Details */}
            <div className="w-full space-y-3.5 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Contact className="w-3.5 h-3.5" />
                  Employee ID
                </span>
                <span className="font-bold text-foreground">{staff.employee_id || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  Date of Joining
                </span>
                <span className="font-bold text-foreground">
                  {staff.join_date ? new Date(staff.join_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  }) : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Fingerprint className="w-3.5 h-3.5" />
                  Biometric Wizard
                </span>
                <span className={cn(
                  "font-bold text-xs flex items-center gap-1",
                  staff.face_registered ? "text-emerald-500" : "text-rose-500"
                )}>
                  {staff.face_registered ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-500/15" />
                      Active
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Pending Setup
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns - Details Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
            <h3 className="font-bold text-sm text-foreground mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Personal & Contact Settings
            </h3>

            {isSuccess && (
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Contact details and preferences updated successfully!</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 text-rose-600 rounded-lg text-xs font-semibold mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Official Email - Disabled */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Official Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <input
                      type="email"
                      disabled
                      value={staff.email}
                      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-muted/30 text-muted-foreground text-sm cursor-not-allowed"
                    />
                  </div>
                  <span className="block text-[9px] text-muted-foreground mt-1">
                    Official email addresses cannot be self-modified.
                  </span>
                </div>

                {/* Contact Number */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      required
                      placeholder="8600510958"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Emergency Contact Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      required
                      placeholder="7709586644"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>

                {/* Blood Group */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Blood Group
                  </label>
                  <div className="relative">
                    <Heart className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Residential Address */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Residential Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea
                    rows={2}
                    required
                    placeholder="Residential address details..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60 resize-none"
                  />
                </div>
              </div>

              <hr className="border-border my-6" />

              {/* Notification Preferences */}
              <div className="space-y-4">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                  <BellRing className="w-3.5 h-3.5 text-primary" />
                  Notification & Alerts Settings
                </h4>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={prefPayroll}
                      onChange={(e) => setPrefPayroll(e.target.checked)}
                      className="mt-1 h-3.5 w-3.5 rounded-sm border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">Salary Slip Release Alerts</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">Receive immediate notifications on dashboard when a monthly salary slip is issued.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={prefAnnouncements}
                      onChange={(e) => setPrefAnnouncements(e.target.checked)}
                      className="mt-1 h-3.5 w-3.5 rounded-sm border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">School Announcements Alerts</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">Alert me when the principal broadcasts school-wide updates and staff notices.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={prefBiometrics}
                      onChange={(e) => setPrefBiometrics(e.target.checked)}
                      className="mt-1 h-3.5 w-3.5 rounded-sm border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">Daily Check-in Reminders</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">Send geofencing reminders if I have not checked in within 15 minutes of shift start.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-4 gap-3">
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
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Add to Home Screen (PWA Install Card) */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
            <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" />
              Add to Home Screen
            </h3>
            
            {isStandalone ? (
              <div className="p-3.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Running in mobile standalone mode (Installed)</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Install the MPS Staff Portal on your mobile device to receive biometric wizard alerts, push announcements, and run the app in full-screen offline mode.
                </p>

                {isIOS ? (
                  <div className="p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg text-xs leading-relaxed font-medium">
                    To install on iOS: Tap the <strong className="font-semibold">Share</strong> button in Safari (square with up arrow), scroll down, and select <strong className="font-semibold">Add to Home Screen</strong>.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {deferredPrompt ? (
                      <button
                        onClick={handleInstallApp}
                        disabled={isInstalling}
                        className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isInstalling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        {isInstalling ? "Installing App..." : "Add to Home Screen"}
                      </button>
                    ) : (
                      <div className="p-3 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg text-xs leading-relaxed font-medium">
                        To install on Android / Chrome: Tap the browser menu button (three vertical dots in top right) and select <strong className="font-semibold">Install app</strong> or <strong className="font-semibold">Add to Home Screen</strong>.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Security Box */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
            <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Account Security
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              To update your account password, you can trigger a password change request. You will be prompted to enter a new password.
            </p>
            <button
              onClick={() => {
                alert("For security purposes, you will be redirected to the secure Change Password panel.");
                window.location.href = "/auth/change-password";
              }}
              className="px-4 py-2 border border-border hover:bg-accent hover:text-accent-foreground font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              Change Account Password
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
