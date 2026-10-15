"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResQProvider, useResQ } from "../../context/ResQContext";
import { PortalRoleCategory, UserRole } from "../../types/resq";

function SignupPageContent() {
  const router = useRouter();
  const { signup } = useResQ();

  const [selectedCategory, setSelectedCategory] = useState<PortalRoleCategory>("user");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+91 ");
  const [specificRole, setSpecificRole] = useState<UserRole>("Public / Citizen");
  const [agency, setAgency] = useState("Public Resident / Citizen");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCategoryChange = (cat: PortalRoleCategory) => {
    setSelectedCategory(cat);
    setErrorMsg(null);
    if (cat === "user") {
      setSpecificRole("Public / Citizen");
      setAgency("Public Resident / Citizen");
    } else if (cat === "admin") {
      setSpecificRole("Command Officer / Incident Commander");
      setAgency("National Disaster Management Authority (NDMA)");
    } else {
      setSpecificRole("Medic / Ambulance Team");
      setAgency("Emergency Medical Services (EMS 108)");
    }
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    let finalRole: UserRole = specificRole;
    if (selectedCategory === "user") {
      finalRole = "Public / Citizen";
    }

    const newUser = signup({
      name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role: finalRole,
      agency: agency.trim() || (selectedCategory === "user" ? "Public Citizen" : "Emergency Operations Division"),
      badgeNumber: badgeNumber.trim() || undefined,
      password: password,
    });

    setSuccessMsg(`Account created for ${newUser.name}! Entering your customized dashboard...`);
    setTimeout(() => {
      router.push("/");
    }, 450);
  };

  const inputClass =
    "w-full bg-[#0b1324] border border-border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition focus:outline-none focus:border-info focus:ring-1 focus:ring-info";

  return (
    <div className="min-h-screen w-screen bg-[#070d18] text-[#f8fafc] flex flex-col justify-between overflow-x-hidden font-sans">
      {/* Top Banner */}
      <header className="h-14 bg-[#093452] border-b border-[#062338] px-4 sm:px-6 flex items-center justify-between shadow-md">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-full bg-sky-400/20 border border-white/30 flex items-center justify-center text-base shadow-sm group-hover:scale-105 transition">
            🛡️
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="text-xl font-extrabold text-white tracking-tight">ResQ</span>
              <span className="text-xs font-light text-sky-200">GeoPlatform</span>
            </div>
            <div className="text-[9px] text-sky-200/80">NDMA Disaster Response Coordination Hub</div>
          </div>
        </Link>

        <Link
          href="/login"
          className="text-xs bg-white/10 hover:bg-white/20 border border-white/15 text-white px-3 py-1.5 rounded-full transition flex items-center gap-1.5"
        >
          <span>←</span> Back to Sign In
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="bg-[#0b1324] border border-border rounded-2xl shadow-2xl max-w-xl w-full p-6 md:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Create a ResQ Account
            </h1>
            <p className="text-xs text-muted">
              Register to access real-time emergency services, situational maps, and relief response.
            </p>
          </div>

          {/* Role Category Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Select Registration Role <span className="text-sky-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleCategoryChange("user")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "user"
                    ? "bg-sky-950/80 border-sky-500 shadow-md ring-1 ring-sky-500 text-white"
                    : "bg-surface-muted/60 border-border text-muted hover:border-slate-700 hover:text-foreground"
                }`}
              >
                <span className="text-xl mb-1">👤</span>
                <div>
                  <div className="text-xs font-bold">Citizen</div>
                  <div className="text-[9.5px] text-muted">SOS & Shelters</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("admin")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "admin"
                    ? "bg-blue-950/80 border-blue-500 shadow-md ring-1 ring-blue-500 text-white"
                    : "bg-surface-muted/60 border-border text-muted hover:border-slate-700 hover:text-foreground"
                }`}
              >
                <span className="text-xl mb-1">🛡️</span>
                <div>
                  <div className="text-xs font-bold">Administrator</div>
                  <div className="text-[9.5px] text-muted">Command Deck</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("service_provider")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "service_provider"
                    ? "bg-amber-950/80 border-amber-500 shadow-md ring-1 ring-amber-500 text-white"
                    : "bg-surface-muted/60 border-border text-muted hover:border-slate-700 hover:text-foreground"
                }`}
              >
                <span className="text-xl mb-1">🚑</span>
                <div>
                  <div className="text-xs font-bold">Responder</div>
                  <div className="text-[9.5px] text-muted">Medic & NDRF</div>
                </div>
              </button>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div role="alert" className="p-3 bg-red-950/80 border border-red-700/60 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <span aria-hidden>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div role="status" className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
              <span aria-hidden>✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Full Name <span className="text-sky-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Captain Rajesh Verma"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Email Address <span className="text-sky-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@agency.gov.in"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Assigned Agency / Department
                </label>
                <input
                  type="text"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  placeholder="e.g. NDRF 5th Battalion"
                  className={inputClass}
                />
              </div>
            </div>

            {selectedCategory !== "user" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Official Badge / Service ID
                </label>
                <input
                  type="text"
                  value={badgeNumber}
                  onChange={(e) => setBadgeNumber(e.target.value)}
                  placeholder="e.g. NDRF-DEL-4029"
                  className={inputClass}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Password <span className="text-sky-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Confirm Password <span className="text-sky-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition shadow-md shadow-sky-950/40 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Register & Enter Portal</span>
              <span aria-hidden>→</span>
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
            <span>Already have an account?</span>
            <Link
              href="/login"
              className="text-sky-400 hover:text-sky-300 font-semibold transition"
            >
              Sign In Instead →
            </Link>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="py-4 border-t border-border bg-[#0b1324]/60 text-center text-[11px] text-muted">
        National Disaster Management Authority (NDMA) · ResQ Emergency GIS Coordination System
      </footer>
    </div>
  );
}

export default function SignupPage() {
  return (
    <ResQProvider>
      <SignupPageContent />
    </ResQProvider>
  );
}
