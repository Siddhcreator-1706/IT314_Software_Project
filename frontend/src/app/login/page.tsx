"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResQProvider, useResQ } from "../../context/ResQContext";
import { PortalRoleCategory, UserProfile } from "../../types/resq";
import { DEMO_USERS } from "../../services/resqStorage";

function LoginPageContent() {
  const router = useRouter();
  const { login, allUsers } = useResQ();

  const [selectedCategory, setSelectedCategory] = useState<PortalRoleCategory>("user");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCategoryChange = (cat: PortalRoleCategory) => {
    setSelectedCategory(cat);
    setErrorMsg(null);
  };

  const handleQuickDemoLogin = (user: UserProfile) => {
    setErrorMsg(null);
    setSuccessMsg(`Signing in as ${user.name} (${user.role})...`);
    setTimeout(() => {
      login(user);
      router.push("/");
    }, 450);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const identifier = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();

    if (!identifier) {
      setErrorMsg("Please enter your email or badge ID.");
      return;
    }

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

    setSuccessMsg(`Welcome back, ${found.name}! Loading ${found.role} dashboard...`);
    setTimeout(() => {
      login(found);
      router.push("/");
    }, 400);
  };

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
              SIGN IN TO RESQ
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              Select your role category below to enter your operational workspace.
            </p>
          </div>

          {/* Role Category Selector */}
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
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">SOS & Shelters</div>
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
                    ADMIN
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">Command & Triage</div>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <div className={`text-xs font-mono font-bold ${selectedCategory === "service_provider" ? "text-white" : "text-slate-300"}`}>
                    RESPONDER
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">Medic, Fire & NDRF</div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick 1-Click Demo */}
          <div className="p-3 bg-[#070b14] rounded-lg border border-slate-800 font-mono">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                QUICK 1-CLICK TEST PRESETS:
              </span>
              <span className="text-[9px] text-slate-400">INSTANT ACCESS</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {demoPresets.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickDemoLogin(u)}
                  className="text-xs bg-[#0B111E] hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-2.5 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5 font-mono"
                >
                  <span className="font-semibold text-white">{u.name}</span>
                  <span className="text-[10px] text-sky-400">({u.role.split("/")[0]})</span>
                </button>
              ))}
            </div>
          </div>

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

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address or Badge ID
              </label>
              <input
                type="text"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder={
                  selectedCategory === "user"
                    ? "citizen@example.com"
                    : selectedCategory === "admin"
                    ? "commander@resq.gov.in"
                    : "medic@resq.gov.in"
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password (e.g. admin123password)"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-lg shadow-sky-600/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Sign In as {selectedCategory === "user" ? "Citizen" : selectedCategory === "admin" ? "Administrator" : "Service Provider"}</span>
              <span>→</span>
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2">
            <div>
              Don&apos;t have an account yet?{" "}
              <Link href="/signup" className="text-sky-400 hover:text-sky-300 font-bold underline">
                Sign Up / Register here
              </Link>
            </div>
            <div>
              <Link href="/" className="text-slate-400 hover:text-slate-200">
                Or continue browsing general dashboard as guest →
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 text-center text-[11px] text-slate-500 border-t border-slate-800/60 bg-slate-950">
        ResQ Disaster Response Coordination Hub • National Emergency Portal (112)
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <ResQProvider>
      <LoginPageContent />
    </ResQProvider>
  );
}
