"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button, Field } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

// Fictional demo accounts created by the seed script (see README).
const DEMO = [
  { label: "Project Lead", email: "lead@inspectflow.demo" },
  { label: "Developer", email: "dev@inspectflow.demo" },
  { label: "Tester", email: "tester@inspectflow.demo" },
  { label: "Client", email: "client@inspectflow.demo" },
];
const DEMO_PASSWORD = "Demo@12345";
const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO !== "false";

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace("/app/projects");
  }, [user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      router.replace("/app/projects");
    } catch (err) {
      setFormError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back. Sign in to see your projects and tickets.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <Field label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        {formError && <p className="rounded-lg bg-dangersoft px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}
        <Button type="submit" variant="primary" className="w-full" loading={busy}>Sign in</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        New here? <Link href="/register" className="font-medium text-brand hover:underline">Create an account</Link>
      </p>

      {showDemo && (
        <details className="mt-6 rounded-lg border border-line bg-surface2 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Demo accounts</summary>
          <p className="mt-2 text-muted">Fictional users for the demonstration project. Click one to fill the form.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); setErrors({}); }}
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-left hover:border-brand">
                <span className="block font-medium">{d.label}</span>
                <span className="block truncate text-xs text-muted">{d.email}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
