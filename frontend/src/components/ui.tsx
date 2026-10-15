"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- buttons

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "xs" | "sm" | "md" | "lg";
  busy?: boolean;
};

export function Button({ variant = "secondary", size = "md", busy, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none",
        size === "xs" && "h-7 px-2.5 text-xs rounded-md",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-11 px-5 text-base font-semibold",
        variant === "primary" && "bg-sky-600 text-white shadow-sm shadow-sky-900/30 hover:bg-sky-500 active:bg-sky-700 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070d18]",
        variant === "secondary" && "border border-border bg-surface text-foreground hover:bg-surface-muted hover:border-slate-700 active:bg-surface-elevated",
        variant === "danger" && "bg-red-600 text-white shadow-sm shadow-red-950/40 hover:bg-red-500 active:bg-red-700",
        variant === "ghost" && "text-muted hover:bg-surface-muted hover:text-foreground active:bg-surface-elevated",
        variant === "outline" && "border border-border-muted text-muted hover:border-sky-500 hover:text-sky-300 hover:bg-sky-950/30",
        className,
      )}
    >
      {busy && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

// ----------------------------------------------------------------- badges

export type Tone = "critical" | "high" | "medium" | "low" | "info" | "ai" | "neutral";

const toneClass: Record<Tone, string> = {
  critical: "bg-critical-soft text-critical border border-critical/30",
  high: "bg-high-soft text-high border border-high/30",
  medium: "bg-medium-soft text-medium border border-medium/30",
  low: "bg-low-soft text-low border border-low/30",
  info: "bg-info-soft text-info border border-info/30",
  ai: "bg-ai-soft text-ai border border-ai/30",
  neutral: "bg-neutral-soft text-muted border border-border",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide", toneClass[tone], className)}>
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ layout

export function Card({ title, subtitle, actions, children, className, bodyClassName }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("min-w-0 rounded-xl border border-border bg-surface shadow-sm overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/50 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="font-semibold text-sm sm:text-base text-foreground tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0 rounded-lg border border-border/40 bg-surface-muted/30 p-2.5">
          <dt className="text-xs font-medium text-muted uppercase tracking-wider">{k}</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground break-words">{v ?? <span className="text-muted/60">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------- loading / empty / error

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-surface-muted", className)} aria-hidden />;
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted/20 px-4 py-12 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-md text-xs text-muted leading-relaxed">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-critical/40 bg-critical-soft px-4 py-3 text-sm text-critical shadow-sm">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base">⚠️</span>
        <span className="font-medium">{message}</span>
      </div>
      {onRetry && (
        <Button size="sm" variant="danger" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cx("rounded-xl px-4 py-3 text-xs sm:text-sm font-medium", toneClass[tone])}>{children}</div>;
}

// ------------------------------------------------------------------- forms

const fieldBase =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted/70 transition focus:border-info focus:ring-1 focus:ring-info focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed";

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode; id?: string }) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>
      {children(fieldId)}
      {hint && !error && <p className="text-[11px] text-muted">{hint}</p>}
      {error && <p className="text-[11px] font-medium text-critical">{error}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldBase, "h-10", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldBase, "h-10 cursor-pointer", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(fieldBase, "py-2.5", props.className)} />;
}

// ------------------------------------------------------------------ dialog

export function Dialog({ open, onClose, title, children, footer, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="dialog-title"
      className={cx(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:backdrop-blur-sm",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-border bg-surface-muted/60 px-5 py-3.5">
            <h2 id="dialog-title" className="font-bold text-sm sm:text-base text-white tracking-tight">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated hover:text-white transition" aria-label="Close">
              ✕
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2.5 border-t border-border bg-surface-muted/40 px-5 py-3.5">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

// ------------------------------------------------------------------ toasts

type Toast = { id: number; tone: "success" | "error"; message: string };
const ToastContext = createContext<(tone: Toast["tone"], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 8000 : 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[9999] flex flex-col items-end gap-2.5 sm:left-auto" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cx(
              "pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-xs sm:text-sm shadow-xl font-medium",
              t.tone === "success" ? "border-low/40 bg-low-soft text-low" : "border-critical/40 bg-critical-soft text-critical",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// -------------------------------------------------------------- pagination

export function Pagination({ page, pages = 1, total, onPage }: { page: number; pages?: number; total: number; onPage: (p: number) => void }) {
  const pageCount = pages ?? 1;
  if (pageCount <= 1) return <p className="text-xs text-muted font-medium">{total} total items</p>;
  return (
    <nav className="flex items-center justify-between gap-3 text-xs" aria-label="Pagination">
      <p className="text-muted font-medium">
        Page <span className="text-foreground font-semibold">{page}</span> of <span className="text-foreground font-semibold">{pages}</span> · {total} total
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
