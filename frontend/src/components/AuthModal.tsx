"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { PortalRoleCategory, UserProfile, UserRole } from "../types/resq";
import { DEMO_USERS } from "../services/resqStorage";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "signup";
  initialRoleCategory?: PortalRoleCategory;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = "login",
  initialRoleCategory = "user",
}) => {
  const { login, signup, allUsers } = useResQ();

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [selectedCategory, setSelectedCategory] = useState<PortalRoleCategory>(initialRoleCategory);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("+91 ");
  const [specificRole, setSpecificRole] = useState<UserRole>("Public / Citizen");
  const [agency, setAgency] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (!isOpen) return null;

  // Handle switching category
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

  // Quick One-Click Demo Login
  const handleQuickDemoLogin = (user: UserProfile) => {
    setErrorMsg(null);
    setSuccessMsg(`Authenticating as ${user.name} (${user.role})...`);
    setTimeout(() => {
      login(user);
      setSuccessMsg(null);
      onClose();
    }, 450);
  };

  // Submit Login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const identifier = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();

    if (!identifier) {
      setErrorMsg("Please enter your email or badge ID.");
      return;
    }

    // Find in all registered & demo users
    const found = allUsers.find(
      (u) =>
        u.email.toLowerCase() === identifier ||
        u.id.toLowerCase() === identifier ||
        (u.badgeNumber && u.badgeNumber.toLowerCase() === identifier)
    );

    if (!found) {
      setErrorMsg(`No account found matching "${identifier}". You can use the Quick Demo buttons below or Sign Up.`);
      return;
    }

    if (found.password && password && found.password !== password) {
      setErrorMsg("Incorrect password. Try using the 1-Click Quick Login below.");
      return;
    }

    setSuccessMsg(`Authenticated as ${found.name} (${found.role})`);
    setTimeout(() => {
      login(found);
      setSuccessMsg(null);
      onClose();
    }, 400);
  };

  // Submit Signup
  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }
    if (signupPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    // Check duplicate email
    if (allUsers.some((u) => u.email.toLowerCase() === signupEmail.trim().toLowerCase())) {
      setErrorMsg("An account with this email already exists. Please Sign In.");
      return;
    }

    const newUser = signup({
      name: fullName.trim(),
      email: signupEmail.trim(),
      phone: signupPhone.trim(),
      role: specificRole,
      agency: agency.trim() || (selectedCategory === "user" ? "Public Resident" : "Emergency Services"),
      badgeNumber: badgeNumber.trim() || undefined,
      password: signupPassword,
    });

    setSuccessMsg(`Account created for ${newUser.name}. Entering dashboard...`);
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 500);
  };

  // Filter demo presets for the selected role category
  const demoPresets = DEMO_USERS.filter((u) => {
    if (selectedCategory === "user") return u.role === "Public / Citizen";
    if (selectedCategory === "admin") {
      return (
        u.role === "Command Officer / Incident Commander" ||
        u.role === "Dispatcher" ||
        u.role === "System Administrator"
      );
    }
    return (
      u.role === "Medic / Ambulance Team" ||
      u.role === "Firefighter / Fire Service Officer" ||
      u.role === "NDRF / SDRF Team Leader or Responder" ||
      u.role === "Logistics Officer"
    );
  });

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0B111E] border border-slate-800 text-slate-100 rounded-xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-4 px-6 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase font-mono flex items-center gap-2">
                RESQ PORTAL AUTHENTICATION
                <span className="text-[9px] uppercase font-semibold bg-sky-950 text-sky-400 border border-sky-800 px-2 py-0.5 rounded font-mono">
                  SECURE NET
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                DISASTER RESPONSE COORDINATION HUB • SELECT OPERATIONAL ROLE
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition cursor-pointer"
            title="Close / Continue to General Dashboard"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Sign In vs Sign Up Tabs */}
          <div className="flex bg-[#070b14] p-1 rounded-lg border border-slate-800 font-mono text-xs uppercase">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 rounded transition cursor-pointer flex items-center justify-center gap-2 font-bold ${
                mode === "login"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>SIGN IN</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 rounded transition cursor-pointer flex items-center justify-center gap-2 font-bold ${
                mode === "signup"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>CREATE ACCOUNT</span>
            </button>
          </div>

          {/* STEP 1: Role Category Selection */}
          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
              STEP 1: SELECT ACCESS DOMAIN <span className="text-sky-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Option 1: User / Citizen */}
              <button
                type="button"
                onClick={() => handleCategoryChange("user")}
                className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "user"
                    ? "bg-sky-950/40 border-sky-500 shadow-md ring-1 ring-sky-500"
                    : "bg-[#070b14] border-slate-800 hover:border-slate-700 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  {selectedCategory === "user" && (
                    <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" />
                  )}
                </div>
                <div>
                  <div className={`text-xs font-bold font-mono ${selectedCategory === "user" ? "text-white" : "text-slate-300"}`}>
                    CITIZEN / USER
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-1">
                    SOS report, incident tracker & safe shelters
                  </div>
                </div>
              </button>

              {/* Option 2: Administrator */}
              <button
                type="button"
                onClick={() => handleCategoryChange("admin")}
                className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "admin"
                    ? "bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500"
                    : "bg-[#070b14] border-slate-800 hover:border-slate-700 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  {selectedCategory === "admin" && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" />
                  )}
                </div>
                <div>
                  <div className={`text-xs font-bold font-mono ${selectedCategory === "admin" ? "text-white" : "text-slate-300"}`}>
                    ADMINISTRATOR
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-1">
                    Command triage, dispatch & logistics
                  </div>
                </div>
              </button>

              {/* Option 3: Service Provider */}
              <button
                type="button"
                onClick={() => handleCategoryChange("service_provider")}
                className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "service_provider"
                    ? "bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500"
                    : "bg-[#070b14] border-slate-800 hover:border-slate-700 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  {selectedCategory === "service_provider" && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                  )}
                </div>
                <div>
                  <div className={`text-xs font-bold font-mono ${selectedCategory === "service_provider" ? "text-white" : "text-slate-300"}`}>
                    SERVICE PROVIDER
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-1">
                    Medic, Fire, NDRF field tactical HUD
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick 1-Click Demo Login Presets */}
          {mode === "login" && (
            <div className="p-3 bg-[#070b14] rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  QUICK ONE-CLICK DEMO LOGIN:
                </span>
                <span className="text-[9px] text-slate-400 font-mono">INSTANT CREDENTIALS</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {demoPresets.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickDemoLogin(u)}
                    className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-sky-500 px-2.5 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5 font-mono"
                    title={`Log in as ${u.name} (${u.role})`}
                  >
                    <span className="font-semibold text-white">{u.name}</span>
                    <span className="text-[10px] text-sky-400">
                      {u.role.split("/")[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-red-300 text-xs flex items-center gap-2 font-mono">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs flex items-center gap-2 font-mono">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {/* ============ SIGN IN FORM ============ */}
          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  EMAIL ADDRESS OR BADGE ID
                </label>
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={
                    selectedCategory === "user"
                      ? "citizen@example.com"
                      : selectedCategory === "admin"
                      ? "commander@resq.gov.in or NDMA-HQ-01"
                      : "medic@resq.gov.in or EMS-MED-07"
                  }
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono uppercase text-slate-400">PASSWORD</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer font-mono"
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password (e.g. admin123password)"
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs font-mono uppercase tracking-wider transition shadow-lg shadow-sky-600/30 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>SIGN IN AS {selectedCategory === "user" ? "CITIZEN" : selectedCategory === "admin" ? "ADMINISTRATOR" : "SERVICE PROVIDER"}</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </form>
          ) : (
            /* ============ SIGN UP FORM ============ */
            <form onSubmit={handleSignupSubmit} className="space-y-3 font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1">FULL NAME</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sunil Kumar"
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1">PHONE NUMBER</label>
                  <input
                    type="tel"
                    required
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">EMAIL ADDRESS</label>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="name@domain.gov.in"
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {selectedCategory !== "user" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 mb-1">
                      OPERATIONAL SUB-ROLE
                    </label>
                    <select
                      value={specificRole}
                      onChange={(e) => setSpecificRole(e.target.value as UserRole)}
                      className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
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
                    <label className="block text-[10px] uppercase text-slate-400 mb-1">BADGE / CALLSIGN</label>
                    <input
                      type="text"
                      value={badgeNumber}
                      onChange={(e) => setBadgeNumber(e.target.value)}
                      placeholder={selectedCategory === "admin" ? "NDMA-HQ-05" : "AMB-11 / FIRE-09"}
                      className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">
                  AGENCY / ORGANIZATION
                </label>
                <input
                  type="text"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  placeholder={
                    selectedCategory === "user"
                      ? "Resident / Public Citizen"
                      : "e.g. State Disaster Response Force"
                  }
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1">PASSWORD</label>
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1">CONFIRM PASSWORD</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type password"
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs font-mono uppercase tracking-wider transition shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>REGISTER & ENTER PORTAL</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </form>
          )}

          {/* Guest / Public Mode Fallback */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Public disaster situational overview?</span>
            <button
              type="button"
              onClick={onClose}
              className="text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2 cursor-pointer"
            >
              CONTINUE AS GUEST &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
