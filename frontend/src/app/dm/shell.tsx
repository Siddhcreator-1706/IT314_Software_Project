"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

import { ToastProvider, cx } from "@/components/ui";

export type StaffUser = { name: string; email: string; permissions: string[] };

const UserContext = createContext<StaffUser>({ name: "", email: "", permissions: [] });

/** Permission hints for the UI only; the backend enforces every permission itself. */
export function useStaff() {
  const user = useContext(UserContext);
  return { ...user, can: (permission: string) => user.permissions.includes(permission) };
}

const NAV: { href: string; label: string; icon: string; permission?: string }[] = [
  { href: "/dm", label: "Dashboard", icon: "▦" },
  { href: "/dm/incidents", label: "Incidents", icon: "⚑" },
  { href: "/", label: "Live map", icon: "◎" },
  { href: "/dm/dispatches", label: "Dispatches", icon: "➜" },
  { href: "/dm/resources", label: "Resources", icon: "▣" },
  { href: "/dm/moderation", label: "Moderation", icon: "◐", permission: "MODERATOR" },
  { href: "/dm/updates", label: "Public updates", icon: "✎" },
  { href: "/dm/content", label: "Safety content", icon: "☰" },
  { href: "/dm/aid", label: "Aid & needs", icon: "◆" },
  { href: "/dm/campaigns", label: "Campaigns", icon: "₹" },
  { href: "/dm/analytics", label: "Analytics", icon: "▤" },
];

const PERMISSION_LABEL: Record<string, string> = {
  PUBLISHER: "Publisher",
  MODERATOR: "Moderator",
  CLOSURE: "Closure",
  DISPATCH: "Dispatch",
  SUPERVISOR: "Supervisor",
};

export function DmShell({ user, signOut, children }: { user: StaffUser; signOut: () => Promise<void>; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/dm" || href === "/" ? pathname === href : pathname.startsWith(href));
  const items = NAV.filter((n) => !n.permission || user.permissions.includes(n.permission));

  const nav = (
    <nav aria-label="Workspace Navigation" className="space-y-1">
      <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted">
        Operations Management
      </div>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cx(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium transition-all",
            isActive(item.href)
              ? "bg-sky-500/15 font-semibold text-sky-300 ring-1 ring-sky-500/40 shadow-xs"
              : "text-muted hover:bg-surface-muted hover:text-foreground",
          )}
        >
          <span aria-hidden className="w-5 text-center text-sm">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <UserContext.Provider value={user}>
      <ToastProvider>
        <div className="dm-theme flex h-screen w-full flex-col font-sans bg-[#070d18] text-[#f8fafc]">
          {/* Top Brand Banner */}
          <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-[#062338] bg-[#093452] px-4 text-white shadow-md sm:px-6">
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg p-1.5 text-sky-200 hover:bg-white/10 lg:hidden cursor-pointer"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
              >
                ☰
              </button>
              <Brand />
              <span className="hidden rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-200 md:inline">
                Command Workspace
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 md:flex"
              >
                <span aria-hidden>←</span> Interactive Map
              </Link>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold leading-tight text-white">{user.name}</p>
                <p className="text-[10px] text-sky-200/80">
                  {user.permissions.length ? user.permissions.map((p) => PERMISSION_LABEL[p] ?? p).join(" · ") : "Disaster Management"}
                </p>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 cursor-pointer"
                >
                  Sign out
                </button>
              </form>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-surface p-3 lg:block">
              {nav}
            </aside>

            {open && (
              <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
                <button
                  className="absolute inset-0 bg-black/70 backdrop-blur-xs cursor-pointer"
                  aria-label="Close navigation"
                  onClick={() => setOpen(false)}
                />
                <div className="absolute inset-y-0 left-0 w-64 overflow-y-auto border-r border-border bg-surface p-3 shadow-2xl">
                  <div className="mb-3 flex items-center justify-between border-b border-border pb-2 px-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-300">ResQ Menu</span>
                    <button
                      onClick={() => setOpen(false)}
                      className="rounded p-1 text-muted hover:text-white"
                      aria-label="Close menu"
                    >
                      ✕
                    </button>
                  </div>
                  {nav}
                </div>
              </div>
            )}

            {/* Scrollable content pane */}
            <div className="min-w-0 flex-1 overflow-y-auto">
              <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
            </div>
          </div>
        </div>
      </ToastProvider>
    </UserContext.Provider>
  );
}

function Brand() {
  return (
    <Link href="/dm" className="flex items-center gap-2.5 group">
      <span className="flex size-8 items-center justify-center rounded-full border border-white/30 bg-sky-400/20 text-base shadow-sm group-hover:scale-105 transition" aria-hidden>
        🛡️
      </span>
      <span className="leading-tight">
        <span className="flex items-baseline gap-1.5">
          <span className="text-xl font-extrabold tracking-tight">ResQ</span>
          <span className="text-xs font-light text-sky-200">Command</span>
        </span>
        <span className="block text-[9px] text-sky-200/80">NDMA Response Coordination Hub</span>
      </span>
    </Link>
  );
}
