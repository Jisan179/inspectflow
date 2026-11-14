"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button, Field } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name (at least 2 characters)").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
});

export default function RegisterPage() {
  const { user, register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace("/app/projects");
  }, [user, router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ name: f.name?.[0], email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await register(parsed.data.name, parsed.data.email, parsed.data.password);
      router.replace("/app/projects");
    } catch (err) {
      setFormError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Start a project or get added to one by your team lead.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <Field label="Full name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
        <Field label="Email" type="email" autoComplete="username" value={form.email} onChange={set("email")} error={errors.email} />
        <Field label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 8 characters." />
        {formError && <p className="rounded-lg bg-dangersoft px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}
        <Button type="submit" variant="primary" className="w-full" loading={busy}>Create account</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Already registered? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
      </p>
    </>
  );
}
