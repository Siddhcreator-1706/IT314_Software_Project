"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import { AuthLanguageProvider, isSupportedAuthLanguage, useAuthLanguage } from "@/components/auth/AuthLanguage";

import { StaffSignIn } from "./staff-sign-in";

function LoginCard() {
  const next = useSearchParams().get("next") ?? undefined;
  const { language, setLanguage, copy } = useAuthLanguage();
  return (
    <div className="space-y-6 rounded-2xl bg-white p-6 shadow-lg sm:p-8">
      <div className="flex items-center justify-end gap-2">
        <label htmlFor="auth-language" className="text-sm font-semibold text-slate-700">{copy.language}</label>
        <select
          id="auth-language"
          value={language}
          onChange={(event) => {
            const selected = event.currentTarget.value;
            if (isSupportedAuthLanguage(selected)) setLanguage(selected);
          }}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
          <option value="gu">ગુજરાતી</option>
        </select>
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{copy.signIn}</h1>
        <p className="mt-3 text-base text-slate-600">
          {copy.loginDescription}
        </p>
      </div>

      <StaffSignIn next={next} />

      <div className="space-y-3 border-t border-slate-200 pt-5 text-center">
        <div className="flex justify-center gap-4 text-sm text-slate-600">
          <Link href="/forgot-password" className="font-semibold text-sky-800 underline hover:text-sky-900">
            Forgot password?
          </Link>
          <span>•</span>
          <Link href="/setup-account" className="font-semibold text-sky-800 underline hover:text-sky-900">
            Staff invitation setup
          </Link>
        </div>
        <p className="text-base text-slate-700">{copy.newHere}</p>
        <Link
          href="/signup"
          className="flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-sky-700 px-2 text-center text-lg font-bold text-sky-800 hover:bg-sky-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
        >
          {copy.createAccount}
        </Link>
      </div>

      <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-600">
        {copy.publicMapNote}{" "}
        <Link href="/" className="font-semibold text-sky-800 underline">{copy.publicMap}</Link>{" "}
        {copy.andRead}{" "}
        <Link href="/safety" className="font-semibold text-sky-800 underline">{copy.safetyGuidance}</Link>.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthLanguageProvider>
      <AuthShell>
        <Suspense fallback={<p className="text-center text-base text-slate-600">Loading…</p>}>
          <LoginCard />
        </Suspense>
      </AuthShell>
    </AuthLanguageProvider>
  );
}
