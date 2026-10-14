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

    setSuccessMsg(`Account created for ${newUser.name}. Redirecting to operational console...`);
    setTimeout(() => {
      router.push("/");
    }, 450);
  };

  return (
    <div className="min-h-screen w-screen bg-[#070d18] text-white flex flex-col justify-between overflow-x-hidden font-sans">
      {/* Top Banner */}
      <header className="h-14 bg-[#070b14] border-b border-slate-800 px-6 flex items-center justify-between shadow-md">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 leading-tight font-mono">
              <span className="text-lg font-bold text-white tracking-wider">RESQ</span>
              <span className="text-xs font-light text-sky-400">GEOPLATFORM</span>
            </div>
            <div className="text-[9px] text-slate-400 font-mono">NDMA DISASTER RESPONSE COORDINATION HUB</div>
          </div>
        </Link>

        <Link
          href="/"
          className="text-xs font-mono bg-[#0B111E] hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded transition flex items-center gap-1.5"
        >
          <span>&larr;</span> RETURN TO DASHBOARD
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="bg-[#0B111E] border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6">
          <div className="text-center space-y-1 font-mono">
            <h1 className="text-xl font-bold text-white tracking-wider uppercase">
              OPERATIONAL ONBOARDING
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              Register as Citizen, Incident Commander, or Field Responder for direct GIS dispatch access.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
              STEP 1: SELECT ACCESS DOMAIN <span className="text-sky-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleCategoryChange("user")}
                className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "user"
                    ? "bg-sky-950/40 border-sky-500 shadow-md ring-1 ring-sky-500"
                    : "bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="w-6 h-6 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-2">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <div className={`text-xs font-mono font-bold ${selectedCategory === "user" ? "text-white" : "text-slate-300"}`}>
                    CITIZEN
                  </div>
                  <div className="text-[9.5px] text-slate-400">Emergency SOS Intake</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("admin")}
                className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "admin"
                    ? "bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500"
                    : "bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <div className={`text-xs font-mono font-bold ${selectedCategory === "admin" ? "text-white" : "text-slate-300"}`}>
                    COMMAND
                  </div>
                  <div className="text-[9.5px] text-slate-400">NDMA & Dispatch</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("service_provider")}
                className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "service_provider"
                    ? "bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500"
                    : "bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div className={`text-xs font-mono font-bold ${selectedCategory === "service_provider" ? "text-white" : "text-slate-300"}`}>
                    RESPONDER
                  </div>
                  <div className="text-[9.5px] text-slate-400">Medic, Fire & NDRF</div>
                </div>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-red-300 text-xs flex items-center gap-2 font-mono">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs flex items-center gap-2 font-mono">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-slate-400 mb-1">FULL NAME</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-semibold text-slate-400 mb-1">PHONE NUMBER</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold text-slate-400 mb-1">EMAIL ADDRESS</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@resq.gov.in"
                className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            {selectedCategory !== "user" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-slate-400 mb-1">OPERATIONAL ROLE</label>
                  <select
                    value={specificRole}
                    onChange={(e) => setSpecificRole(e.target.value as UserRole)}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  >
                    {selectedCategory === "admin" ? (
                      <>
                        <option value="Command Officer / Incident Commander">Incident Commander (NDMA)</option>
                        <option value="Dispatcher">Emergency Dispatcher (ERSS 112)</option>
                        <option value="System Administrator">System Administrator (DRCH)</option>
                      </>
                    ) : (
                      <>
                        <option value="Medic / Ambulance Team">Ambulance Paramedic (EMS 108)</option>
                        <option value="Firefighter / Fire Service Officer">Fire & Rescue Officer</option>
                        <option value="NDRF / SDRF Team Leader or Responder">NDRF Rescue Team Leader</option>
                        <option value="Logistics Officer">Disaster Logistics & Relief Officer</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-slate-400 mb-1">BADGE / CALLSIGN</label>
                  <input
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder={selectedCategory === "admin" ? "NDMA-HQ-09" : "AMB-22 / FIRE-15"}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono font-semibold text-slate-400 mb-1">AGENCY / ORGANIZATION</label>
              <input
                type="text"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                placeholder={selectedCategory === "user" ? "Public Resident" : "e.g. State Disaster Response Force"}
                className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-slate-400 mb-1">PASSWORD</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-semibold text-slate-400 mb-1">CONFIRM PASSWORD</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold py-2.5 px-4 rounded-lg text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-900/40 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>COMPLETE REGISTRATION & ENTER PORTAL</span>
                <span>&rarr;</span>
              </button>
            </div>
          </form>

          <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2 font-mono">
            <div>
              Already have an operational account?{" "}
              <Link href="/login" className="text-sky-400 hover:text-sky-300 font-bold underline">
                Sign In here
              </Link>
            </div>
            <div>
              <Link href="/" className="text-slate-500 hover:text-slate-300">
                &larr; Return to general public dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-3 text-center text-[10px] font-mono text-slate-500 border-t border-slate-900 bg-[#070b14]">
        RESQ DISASTER RESPONSE COORDINATION HUB &bull; NATIONAL EMERGENCY PORTAL (112)
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
