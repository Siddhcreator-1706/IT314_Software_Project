"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ResQProvider, useResQ } from "../../context/ResQContext";
import { PortalRoleCategory, UserProfile } from "../../types/resq";
import { DEMO_USERS } from "../../services/resqStorage";
import { StaffSignIn } from "./staff-sign-in";
import { backendLogin, checkBackendHealth } from "../../services/authApi";

// Administrator (Command & Dispatch) signs in against the backend; other tabs keep the demo flow.
const usesStaffSignIn = (category: PortalRoleCategory): boolean => category === "admin";

function LoginPageContent() {
  const router = useRouter();
  const { login, allUsers } = useResQ();
  const next = useSearchParams().get("next") ?? undefined;

  const [selectedCategory, setSelectedCategory] = useState<PortalRoleCategory>(next?.startsWith("/dm") ? "admin" : "user");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);

  useEffect(() => {
    checkBackendHealth().then((isHealthy) => setBackendConnected(isHealthy));
  }, []);

  const handleCategoryChange = (cat: PortalRoleCategory) => {
    setSelectedCategory(cat);
    setErrorMsg(null);
  };

  const handleQuickDemoLogin = async (user: UserProfile) => {
    setErrorMsg(null);
    setSuccessMsg(`Signing in as ${user.name} (${user.role})...`);
    backendLogin(user.email, user.password || "").catch(() => {});
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

    const localMatch = allUsers.find(
      (u) =>
        u.email.toLowerCase() === identifier ||
        u.id.toLowerCase() === identifier ||
        (u.badgeNumber && u.badgeNumber.toLowerCase() === identifier)
    );

    const apiRes = await backendLogin(
      identifier,
      password,
      localMatch
        ? {
            role: localMatch.role,
            name: localMatch.name,
            agency: localMatch.agency,
          }
        : undefined
    );

    if (apiRes.success && apiRes.user) {
      setSuccessMsg(`✓ Authenticated via FastAPI Gateway! Welcome back, ${apiRes.user.name}!`);
      setTimeout(() => {
        login(apiRes.user!);
        router.push("/");
      }, 400);
      return;
    }

    if (localMatch) {
      if (localMatch.password && password && localMatch.password !== password) {
        setErrorMsg("Incorrect password. Try using the 1-Click Quick Login below.");
        return;
      }
      setSuccessMsg(`Welcome back, ${localMatch.name}! Loading ${localMatch.role} dashboard...`);
      setTimeout(() => {
        login(localMatch);
        router.push("/");
      }, 400);
      return;
    }

    setErrorMsg(
      apiRes.error ||
        `No account found matching "${identifier}". You can use the Quick Demo buttons below or Sign Up.`
    );
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

        <div className="flex items-center gap-3">
          {backendConnected !== null && (
            <span
              className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                backendConnected
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-600/50"
                  : "bg-amber-950/80 text-amber-300 border-amber-600/50"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${backendConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
              {backendConnected ? "FastAPI Online" : "Demo Offline"}
            </span>
          )}
          <Link
            href="/"
            className="text-xs bg-white/10 hover:bg-white/20 border border-white/15 text-white px-3 py-1.5 rounded-full transition flex items-center gap-1.5"
          >
            <span>←</span> Back to Operations
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="bg-[#0b1324] border border-border rounded-2xl shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Sign In to ResQ
            </h1>
            <p className="text-xs text-muted">
              Select your role category below to enter your operational workspace.
            </p>
          </div>

          {/* Role Category Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Who is logging in? <span className="text-sky-400">*</span>
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
                  <div className="text-xs font-bold">Citizen / User</div>
                  <div className="text-[9.5px] text-muted">Distress SOS & Shelters</div>
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
                  <div className="text-[9.5px] text-muted">Command & Dispatch</div>
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
                  <div className="text-xs font-bold">Service Provider</div>
                  <div className="text-[9.5px] text-muted">Medic, Fire & NDRF</div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick 1-Click Demo */}
          {!usesStaffSignIn(selectedCategory) && (
            <div className="p-3 bg-surface-muted/70 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  <span>⚡</span> Quick 1-Click Demo Presets:
                </span>
                <span className="text-[10px] text-muted">Instant Access</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {demoPresets.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickDemoLogin(u)}
                    className="p-2 text-left bg-surface hover:bg-surface-elevated border border-border hover:border-sky-500 rounded-lg transition text-xs cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-1">
                      <div className="font-semibold text-white group-hover:text-sky-300 truncate">
                        {u.name}
                      </div>
                      <div className="text-[10px] text-muted truncate">{u.agency || u.role}</div>
                    </div>
                    <span className="text-sky-400 opacity-0 group-hover:opacity-100 transition text-xs font-bold">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {/* Actual Sign-in Form */}
          {usesStaffSignIn(selectedCategory) ? (
            <StaffSignIn next={next} />
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Email Address or Badge ID
                </label>
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. rahul.sharma@example.com"
                  className="w-full bg-[#0b1324] border border-border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition focus:outline-none focus:border-info focus:ring-1 focus:ring-info"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-sky-400 hover:text-sky-300 transition cursor-pointer"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full bg-[#0b1324] border border-border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition focus:outline-none focus:border-info focus:ring-1 focus:ring-info"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition shadow-md shadow-sky-950/40 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Sign In to Console</span>
                <span aria-hidden>→</span>
              </button>
            </form>
          )}

          {/* Footer Navigation */}
          <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
            <span>Don&apos;t have an account?</span>
            <Link
              href="/signup"
              className="text-sky-400 hover:text-sky-300 font-semibold transition"
            >
              Create an Account →
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

export default function LoginPage() {
  return (
    <ResQProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#070d18] text-white grid place-items-center text-sm">Loading ResQ Console…</div>}>
        <LoginPageContent />
      </Suspense>
    </ResQProvider>
  );
}
