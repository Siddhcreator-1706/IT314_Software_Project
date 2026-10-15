"use client";

import { useActionState, useState } from "react";
import { authenticate, type LoginState } from "./actions";

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="p-3 bg-red-950/80 border border-red-700/60 rounded-xl text-red-200 text-xs flex items-center gap-2">
      <span aria-hidden>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

/**
 * Administrator (Command & Dispatch) sign-in. Authenticates against the DRCH backend:
 * password, then the staff member's authenticator code (DM-FR-01).
 */
export function StaffSignIn({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(authenticate, { step: "password" });
  const [showPassword, setShowPassword] = useState(false);

  const inputClass =
    "w-full bg-[#0b1324] border border-border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition focus:outline-none focus:border-info focus:ring-1 focus:ring-info";
  const buttonClass =
    "w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-60 disabled:cursor-wait text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition shadow-md shadow-sky-950/40 cursor-pointer flex items-center justify-center gap-2";

  if (state.step === "mfa") {
    return (
      <form action={action} className="space-y-4">
        <input type="hidden" name="intent" value="mfa" />
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="p-3.5 bg-sky-950/60 border border-sky-700/50 rounded-xl text-sky-100 text-xs leading-relaxed">
          🔐 Enter the 6-digit code from the authenticator app for <strong>{state.email}</strong>.
        </div>
        <div>
          <label htmlFor="staff-code" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Verification code
          </label>
          <input
            id="staff-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="123456"
            className={`${inputClass} font-mono tracking-[0.4em] text-center text-lg`}
          />
        </div>
        {state.error && <ErrorBox message={state.error} />}
        <button type="submit" className={buttonClass} disabled={pending}>
          <span>{pending ? "Verifying…" : "Verify & Open Workspace"}</span>
          <span aria-hidden>→</span>
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="intent" value="password" />
      <div>
        <label htmlFor="staff-email" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Staff Email Address
        </label>
        <input
          id="staff-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          placeholder="commander@resq.gov.in"
          className={inputClass}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="staff-password" className="text-xs font-semibold uppercase tracking-wider text-muted">
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
          id="staff-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="Enter your staff password"
          className={inputClass}
        />
      </div>
      {state.error && <ErrorBox message={state.error} />}
      <button type="submit" className={buttonClass} disabled={pending}>
        <span>{pending ? "Authenticating…" : "Sign In as Administrator"}</span>
        <span aria-hidden>→</span>
      </button>
      <p className="text-[11px] text-muted text-center leading-relaxed">
        Staff accounts are issued by Application Management. Multi-factor authentication is required.
      </p>
    </form>
  );
}
