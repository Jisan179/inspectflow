"use client";

import { useState } from "react";
import useSWR from "swr";
import { Trash2, UserPlus } from "lucide-react";
import { Button, Card, ErrorState, Field, Loading, Modal, PageHeader, RoleBadge, Select, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useProject } from "@/lib/project-context";
import { ROLE_LABEL, type Role } from "@/lib/types";

interface Member {
  id: string;
  role: Role;
  user: { id: string; name: string; email: string };
}

export default function MembersPage() {
  const { project, role } = useProject();
  const { user } = useAuth();
  const toast = useToast();
  const isLead = role === "LEAD";
  const { data, error, isLoading, mutate } = useSWR<Member[]>(`/projects/${project.id}/members`);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  async function changeRole(m: Member, next: Role) {
    try {
      await api(`/projects/${project.id}/members/${m.id}`, { method: "PATCH", body: { role: next } });
      toast(`${m.user.name} is now ${ROLE_LABEL[next]}`);
      await mutate();
    } catch (e) {
      toast((e as Error).message, "error");
      await mutate();
    }
  }

  async function remove(m: Member) {
    try {
      await api(`/projects/${project.id}/members/${m.id}`, { method: "DELETE" });
      toast(`${m.user.name} was removed`);
      setRemoving(null);
      await mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <>
      <PageHeader title="Members" subtitle="Permissions come from each person's role in this project."
        actions={isLead && <Button variant="primary" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" aria-hidden="true" /> Add member</Button>} />
      {isLoading && <Loading />}
      {error && <ErrorState error={error} retry={() => mutate()} />}
      {data && (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line bg-surface2 text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th>{isLead && <th className="px-4 py-3 text-right">Actions</th>}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium">{m.user.name}{m.user.id === user?.id && <span className="ml-2 text-xs text-muted">(you)</span>}</td>
                  <td className="px-4 py-3 text-muted">{m.user.email}</td>
                  <td className="px-4 py-3">
                    {isLead ? (
                      <select aria-label={`Role of ${m.user.name}`} value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)}
                        className="rounded-lg border border-line bg-surface px-2 py-1 text-sm">
                        {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : <RoleBadge value={m.role} />}
                  </td>
                  {isLead && (
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(m)} aria-label={`Remove ${m.user.name}`}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card className="mt-6">
        <h2 className="font-semibold">What each role can do</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li><strong className="text-ink">Project Lead:</strong> everything, including settings, members, widget key and GitHub connection.</li>
          <li><strong className="text-ink">Developer:</strong> triage and work tickets, register builds, link branches and pull requests, see technical evidence.</li>
          <li><strong className="text-ink">Tester / Client:</strong> report issues, follow own reports, verify or reopen fixes, review and approve builds shared with them.</li>
        </ul>
      </Card>

      <AddMemberModal open={adding} onClose={() => setAdding(false)} projectId={project.id} onAdded={() => mutate()} />
      <Modal open={!!removing} title="Remove member" onClose={() => setRemoving(null)}>
        <p className="text-sm">Remove <strong>{removing?.user.name}</strong> from this project? They lose access immediately. Their past reports stay.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setRemoving(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => removing && remove(removing)}>Remove</Button>
        </div>
      </Modal>
    </>
  );
}

function AddMemberModal({ open, onClose, projectId, onAdded }: { open: boolean; onClose: () => void; projectId: string; onAdded: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("DEVELOPER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/projects/${projectId}/members`, { method: "POST", body: { email, role } });
      toast("Member added");
      setEmail("");
      onAdded();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Add a member" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email of a registered user" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required hint="They need an InspectFlow account first." />
        <Select label="Role in this project" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        {error && <p className="rounded-lg bg-dangersoft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>Add member</Button>
        </div>
      </form>
    </Modal>
  );
}
