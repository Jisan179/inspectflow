"use client";

import { useState } from "react";
import { z } from "zod";
import { Button, Card, Field, PageHeader, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Use at least 8 characters").max(72),
});

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    try { await api("/users/me", { method: "PATCH", body: { name } }); await refreshUser(); toast("Profile updated"); }
    catch (err) { toast((err as Error).message, "error"); }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(pw);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setPwErrors({ currentPassword: f.currentPassword?.[0], newPassword: f.newPassword?.[0] });
      return;
    }
    setPwErrors({}); setBusy(true);
    try { await api("/users/me", { method: "PATCH", body: parsed.data }); setPw({ currentPassword: "", newPassword: "" }); toast("Password changed"); }
    catch (err) { setPwErrors({ currentPassword: (err as Error).message }); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Your profile" subtitle={user?.email} />
      <div className="grid max-w-3xl gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Name</h2>
          <form onSubmit={saveName} className="space-y-4">
            <Field label="Display name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
            <Button type="submit" variant="primary">Save</Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Change password</h2>
          <form onSubmit={savePassword} className="space-y-4" noValidate>
            <Field label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} error={pwErrors.currentPassword} />
            <Field label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} error={pwErrors.newPassword} />
            <Button type="submit" variant="primary" loading={busy}>Change password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
