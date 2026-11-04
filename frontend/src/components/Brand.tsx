import Link from "next/link";
import type { ReactNode } from "react";

/** ResQ logo mark: shield + rescue cross + location pin. Mirrors /public/logo.svg. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="ResQ logo" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="resq-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      <path d="M24 2 5 9v13c0 11.5 7.6 19.6 19 24 11.4-4.4 19-12.5 19-24V9L24 2Z" fill="url(#resq-g)" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M21 13h6v8h8v6h-8v8h-6v-8h-8v-6h8v-8Z" fill="#fff" />
      <circle cx="24" cy="24" r="3" fill="#dc2626" />
    </svg>
  );
}

/** Single brand lockup used by every header so the logo is identical everywhere. */
export function Brand({
  href = "/",
  subtitle,
  size = "md",
}: {
  href?: string;
  subtitle?: string;
  size?: "sm" | "md";
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-2.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      aria-label="ResQ home"
    >
      <LogoMark className={size === "sm" ? "size-8 shrink-0" : "size-9 shrink-0"} />
      <span className="min-w-0 leading-tight">
        <span className="block text-lg font-extrabold tracking-tight text-white">ResQ</span>
        {subtitle && <span className="hidden truncate text-[10px] font-medium text-sky-200/90 sm:block">{subtitle}</span>}
      </span>
    </Link>
  );
}

/**
 * Standard top bar: fixed 56px height, same colour, brand left, nav/actions right.
 * Children go in the right-hand area; `center` is an optional context badge.
 */
export function SiteHeader({
  subtitle,
  brandHref = "/",
  badge,
  leading,
  children,
  sticky = true,
  maxWidth = "max-w-7xl",
}: {
  subtitle?: string;
  brandHref?: string;
  badge?: ReactNode;
  leading?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
  maxWidth?: string;
}) {
  return (
    <header
      className={`${sticky ? "sticky top-0" : ""} z-[1000] shrink-0 border-b border-[#093554] bg-[#0c4a75] text-white shadow-md`}
    >
      <div className={`mx-auto flex h-14 w-full ${maxWidth} items-center gap-3 px-4 sm:px-6`}>
        {leading}
        <Brand href={brandHref} subtitle={subtitle} />
        {badge && <span className="hidden md:inline-flex">{badge}</span>}
        <div className="ml-auto flex min-w-0 items-center gap-2">{children}</div>
      </div>
    </header>
  );
}

/** Shared pill-style nav link for headers. */
export function NavLink({
  href,
  children,
  hideBelow,
  variant = "default",
}: {
  href: string;
  children: ReactNode;
  hideBelow?: "sm" | "md" | "lg";
  variant?: "default" | "primary" | "success";
}) {
  const hide = hideBelow === "sm" ? "hidden sm:inline-flex" : hideBelow === "md" ? "hidden md:inline-flex" : hideBelow === "lg" ? "hidden lg:inline-flex" : "inline-flex";
  const tone =
    variant === "primary"
      ? "bg-red-600 hover:bg-red-500 font-bold"
      : variant === "success"
        ? "bg-emerald-600 hover:bg-emerald-500 font-semibold"
        : "bg-white/10 hover:bg-white/20 font-semibold";
  return (
    <Link
      href={href}
      className={`${hide} ${tone} items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300`}
    >
      {children}
    </Link>
  );
}
