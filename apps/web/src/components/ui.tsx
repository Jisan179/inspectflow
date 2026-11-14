"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
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
import {
  BUILD_LABEL,
  ROLE_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type BuildStatus,
  type Role,
  type Severity,
  type TicketStatus,
} from "@/lib/types";

/* ---------------- Logo ---------------- */

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--brand)" />
        <path d="M9 11h14M9 16h9M9 21h5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="22.5" cy="21" r="3.6" fill="none" stroke="#fff" strokeWidth="2.2" />
        <path d="M25 23.6l2.6 2.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: size * 0.7 }}>InspectFlow</span>
    </span>
  );
}

/* ---------------- Buttons ---------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({ variant = "secondary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-brand text-white hover:bg-brandstrong",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-surface2",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        variant === "ghost" && "text-muted hover:bg-surface2 hover:text-ink",
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ---------------- Form fields ---------------- */

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
}

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-brand disabled:opacity-60";

export function Field({ label, hint, error, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input id={id} {...rest} aria-invalid={!!error} className={clsx(inputClass, error && "border-danger")} />
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

export function TextArea({ label, hint, error, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <textarea id={id} {...rest} className={clsx(inputClass, "min-h-24", error && "border-danger")} />
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

export function Select({
  label,
  hint,
  children,
  className,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="space-y-1">
      {label && <label htmlFor={id} className="text-sm font-medium">{label}</label>}
      <select id={id} {...rest} className={clsx(inputClass, className)}>{children}</select>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ---------------- Cards, badges ---------------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-xl border border-line bg-surface p-5 shadow-sm", className)}>{children}</div>;
}

export function Badge({ tone, children }: { tone: "neutral" | "brand" | "danger" | "warn" | "ok"; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-surface2 text-muted",
        tone === "brand" && "bg-brandsoft text-brand",
        tone === "danger" && "bg-dangersoft text-danger",
        tone === "warn" && "bg-warnsoft text-warn",
        tone === "ok" && "bg-oksoft text-ok",
      )}
    >
      {children}
    </span>
  );
}

export const SeverityBadge = ({ value }: { value: Severity }) => (
  <Badge tone={value === "BLOCKER" ? "danger" : value === "HIGH" ? "warn" : value === "MEDIUM" ? "brand" : "neutral"}>
    {SEVERITY_LABEL[value]}
  </Badge>
);
export const StatusBadge = ({ value }: { value: TicketStatus }) => (
  <Badge tone={value === "VERIFIED" ? "ok" : value === "RESOLVED" ? "brand" : value === "IN_PROGRESS" ? "warn" : "neutral"}>
    {STATUS_LABEL[value]}
  </Badge>
);
export const BuildBadge = ({ value }: { value: BuildStatus }) => (
  <Badge tone={value === "APPROVED" ? "ok" : value === "REJECTED" ? "danger" : value === "IN_REVIEW" ? "brand" : "neutral"}>
    {BUILD_LABEL[value]}
  </Badge>
);
export const RoleBadge = ({ value }: { value: Role }) => <Badge tone="brand">{ROLE_LABEL[value]}</Badge>;

/* ---------------- States ---------------- */

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> {label}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-12 text-center" role="alert">
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
      <p className="max-w-md text-sm">{error.message}</p>
      {retry && <Button onClick={retry}>Try again</Button>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <h3 className="font-semibold">{title}</h3>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface2"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Toasts ---------------- */

type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastContext = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={clsx("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg", t.kind === "ok" ? "border-ok/40 bg-oksoft text-ok" : "border-danger/40 bg-dangersoft text-danger")}>
            {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
