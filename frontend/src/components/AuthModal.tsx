"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { PortalRoleCategory, UserProfile, UserRole } from "../types/resq";
import { DEMO_USERS } from "../services/resqStorage";
import { StaffSignIn } from "../app/login/staff-sign-in";
import { backendLogin } from "../services/authApi";

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

  const handleQuickDemoLogin = async (user: UserProfile) => {
    setErrorMsg(null);
    setSuccessMsg(`Signing in as ${user.name} (${user.role})...`);
    backendLogin(user.email, user.password || "").catch(() => {});
    setTimeout(() => {
      login(user);
      setSuccessMsg(null);
      onClose();
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
        setSuccessMsg(null);
        onClose();
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
        setSuccessMsg(null);
        onClose();
      }, 400);
      return;
    }

    setErrorMsg(
      apiRes.error ||
        `No account found matching "${identifier}". You can use the Quick Demo buttons below or Sign Up.`
    );
  };

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
    if (signupPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (signupPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    let finalRole: UserRole = specificRole;
    if (selectedCategory === "user") {
      finalRole = "Public / Citizen";
    }

    const newUser = signup({
      name: fullName.trim(),
      email: signupEmail.trim(),
      phone: signupPhone.trim(),
      role: finalRole,
      agency: agency.trim() || (selectedCategory === "user" ? "Public Citizen" : "Emergency Operations Division"),
      badgeNumber: badgeNumber.trim() || undefined,
      password: signupPassword,
    });

    setSuccessMsg(`Account created for ${newUser.name}! Entering your customized dashboard...`);
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 450);
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

  const inputClass =
    "w-full bg-[#0b1324] border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted/60 transition focus:outline-none focus:border-info focus:ring-1 focus:ring-info";

  return (
    <div className="fixed inset-0 z-[2200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn font-sans">
      <div className="bg-[#0b1324] border border-border text-foreground rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#093452] px-5 py-4 border-b border-[#062338] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🛡️</span>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                {mode === "login" ? "Sign In to ResQ Platform" : "Create Operational ResQ Account"}
              </h3>
              <p className="text-[11px] text-sky-200/80">NDMA Multi-Agency Coordination Gateway</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer text-base font-bold"
            aria-label="Close authentication"
          >
            ✕
          </button>
        </div>

        {/* Tab Mode Switcher */}
        <div className="flex border-b border-border bg-[#0b1324] text-xs font-semibold">
          <button
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 text-center transition cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
              mode === "login"
                ? "border-sky-400 text-sky-300 bg-surface-muted/30"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <span>🔐</span> Sign In
          </button>
          <button
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 text-center transition cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
              mode === "signup"
                ? "border-sky-400 text-sky-300 bg-surface-muted/30"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <span>📝</span> Register Account
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Select Role Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleCategoryChange("user")}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  selectedCategory === "user"
                    ? "bg-sky-950/80 border-sky-500 text-white ring-1 ring-sky-500/50"
                    : "bg-surface-muted/50 border-border text-muted hover:border-slate-700"
                }`}
              >
                <span className="block text-base mb-0.5">👤</span>
                <span className="font-bold block truncate">Citizen</span>
                <span className="text-[9.5px] text-muted block truncate">SOS &amp; Needs</span>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("admin")}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  selectedCategory === "admin"
                    ? "bg-blue-950/80 border-blue-500 text-white ring-1 ring-blue-500/50"
                    : "bg-surface-muted/50 border-border text-muted hover:border-slate-700"
                }`}
              >
                <span className="block text-base mb-0.5">🛡️</span>
                <span className="font-bold block truncate">Administrator</span>
                <span className="text-[9.5px] text-muted block truncate">Command Deck</span>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("service_provider")}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  selectedCategory === "service_provider"
                    ? "bg-amber-950/80 border-amber-500 text-white ring-1 ring-amber-500/50"
                    : "bg-surface-muted/50 border-border text-muted hover:border-slate-700"
                }`}
              >
                <span className="block text-base mb-0.5">🚑</span>
                <span className="font-bold block truncate">Responder</span>
                <span className="text-[9.5px] text-muted block truncate">Medic &amp; Fire</span>
              </button>
            </div>
          </div>

          {/* Quick 1-Click Demo */}
          {mode === "login" && selectedCategory !== "admin" && (
            <div className="p-3 bg-surface-muted/60 rounded-xl border border-border">
              <span className="text-[11px] font-bold text-amber-400 block mb-2">
                ⚡ 1-Click Quick Demo Sign In
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {demoPresets.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickDemoLogin(u)}
                    className="p-2 text-left bg-surface hover:bg-surface-elevated border border-border hover:border-sky-500 rounded-lg text-xs transition cursor-pointer truncate"
                  >
                    <span className="font-semibold text-white block truncate">{u.name}</span>
                    <span className="text-[10px] text-muted block truncate">{u.agency || u.role}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div role="alert" className="p-3 bg-red-950/80 border border-red-700/60 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div role="status" className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Forms */}
          {mode === "login" ? (
            selectedCategory === "admin" ? (
              <StaffSignIn next="/dm" />
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Email or Badge ID
                  </label>
                  <input
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. user@resq.gov.in"
                    className={inputClass}
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
                    placeholder="Enter account password"
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition shadow-sm cursor-pointer"
                >
                  Sign In to ResQ
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="Email address"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Agency / Division
                  </label>
                  <input
                    type="text"
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    placeholder="Agency name"
                    className={inputClass}
                  />
                </div>
              </div>

              {selectedCategory !== "user" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Service Badge Number
                  </label>
                  <input
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder="Badge ID"
                    className={inputClass}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition shadow-sm cursor-pointer mt-2"
              >
                Register Account
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
