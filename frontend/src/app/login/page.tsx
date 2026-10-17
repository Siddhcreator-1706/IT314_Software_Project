"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResQProvider, useResQ } from "../../context/ResQContext";
import { PortalRoleCategory, UserProfile } from "../../types/resq";
import { DEMO_USERS } from "../../services/resqStorage";
import { adminApi } from "../../services/adminApi";

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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const identifier = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();

    if (!identifier) {
      setErrorMsg("Please enter your email or badge ID.");
      return;
    }

    // Authenticate with backend API if password provided
    try {
      if (password) {
        await adminApi.login(identifier, password);
      }
    } catch (apiErr: unknown) {
      if (identifier === "admin@drch.gov.in" || identifier === "admin@resq.gov.in") {
        setErrorMsg((apiErr as Error).message || "Admin authentication failed.");
        return;
      }
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
      <header className="h-14 bg-[#0c4a75] border-b border-[#093554] px-6 flex items-center justify-between shadow-md">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-sky-400/20 border border-white flex items-center justify-center text-lg">
            🛡️
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="text-xl font-extrabold text-white">ResQ</span>
              <span className="text-xs font-light text-sky-200">GeoPlatform</span>
            </div>
            <div className="text-[9px] text-sky-200/80">NDMA Disaster Response Coordination Hub</div>
          </div>
        </Link>

        <Link
          href="/"
          className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition flex items-center gap-1.5"
        >
          <span>←</span> Return to General Dashboard
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="bg-[#0b1324] border border-slate-700/80 rounded-2xl shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Sign In to ResQ
            </h1>
            <p className="text-xs text-slate-400">
              Select your role category below to enter your operational workspace.
            </p>
          </div>

          {/* Role Category Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Who is logging in? <span className="text-sky-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleCategoryChange("user")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "user"
                    ? "bg-sky-950/70 border-sky-500 shadow-md ring-1 ring-sky-500"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="text-xl mb-1">👤</span>
                <div>
                  <div className={`text-xs font-bold ${selectedCategory === "user" ? "text-white" : "text-slate-300"}`}>
                    Citizen / User
                  </div>
                  <div className="text-[9.5px] text-slate-400">Distress SOS & Shelters</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("admin")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "admin"
                    ? "bg-blue-950/70 border-blue-500 shadow-md ring-1 ring-blue-500"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="text-xl mb-1">🛡️</span>
                <div>
                  <div className={`text-xs font-bold ${selectedCategory === "admin" ? "text-white" : "text-slate-300"}`}>
                    Administrator
                  </div>
                  <div className="text-[9.5px] text-slate-400">Command & Dispatch</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("service_provider")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "service_provider"
                    ? "bg-amber-950/70 border-amber-500 shadow-md ring-1 ring-amber-500"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="text-xl mb-1">🚑</span>
                <div>
                  <div className={`text-xs font-bold ${selectedCategory === "service_provider" ? "text-white" : "text-slate-300"}`}>
                    Service Provider
                  </div>
                  <div className="text-[9.5px] text-slate-400">Medic, Fire & NDRF</div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick 1-Click Demo */}
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <span>⚡</span> Quick 1-Click Test Presets:
              </span>
              <span className="text-[10px] text-slate-400">No typing needed</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {demoPresets.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickDemoLogin(u)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <span className="font-semibold text-white">{u.name}</span>
                  <span className="text-[10px] text-sky-400 font-mono">({u.role.split("/")[0]})</span>
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-700/60 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
              <span>✅</span>
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
