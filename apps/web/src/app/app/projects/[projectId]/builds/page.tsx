"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { ExternalLink, GitBranch, PackagePlus, Rocket } from "lucide-react";
import { Badge, BuildBadge, Button, Card, EmptyState, ErrorState, Field, Loading, Modal, PageHeader, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { isEngineer, useProject } from "@/lib/project-context";
import type { Approval, Build } from "@/lib/types";

export default function BuildsPage() {
  const { project, role } = useProject();
  const engineer = isEngineer(role);
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<Build[]>(`/projects/${project.id}/builds`);
  const approvals = useSWR<Approval[]>(engineer ? `/projects/${project.id}/approvals` : null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState("");

  async function removeBuild(id: string, name: string) {
    if (!confirm(`Delete build "${name}"? Its tickets are kept.`)) return;
    try { await api(`/builds/${id}`, { method: "DELETE" }); toast("Build deleted"); await mutate(); }
    catch (e) { toast((e as Error).message, "error"); }
  }

  async function markReady(id: string) {
    setBusyId(id);
    try {
      await api(`/builds/${id}/ready`, { method: "POST" });
      toast("Build shared with clients for review");
      await mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <PageHeader
        title={role === "TESTER_CLIENT" ? "Builds shared with you" : "Builds"}
        subtitle={engineer ? "Register staging builds, then mark them ready so the client can review and approve." : "Review each build and approve it or request changes."}
        actions={engineer && <Button variant="primary" onClick={() => setCreating(true)}><PackagePlus className="h-4 w-4" aria-hidden="true" /> Register build</Button>}
      />
      {isLoading && <Loading />}
      {error && <ErrorState error={error} retry={() => mutate()} />}
      {data && data.length === 0 && (
        <EmptyState icon={<Rocket className="h-8 w-8" />} title={engineer ? "No builds registered" : "Nothing to review yet"}
          text={engineer ? "Register the branch and commit you deployed to staging." : "Builds appear here when the team marks them ready for review."} />
      )}

      <div className="space-y-3">
        {data?.map((b) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{b.name}</h2>
                  <BuildBadge value={b.status} />
                  {(b.blockingTickets ?? 0) > 0 && <Badge tone="danger">{b.blockingTickets} blocking</Badge>}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1"><GitBranch className="h-4 w-4" aria-hidden="true" />{b.branch}</span>
                  <span>commit <code className="rounded bg-surface2 px-1.5 text-xs text-ink">{b.commitSha.slice(0, 10)}</code></span>
                  <span>{formatDateTime(b.createdAt)}</span>
                  {engineer && <span>{b._count?.tickets ?? 0} tickets</span>}
                </p>
                {b.previewUrl && (
                  <a href={b.previewUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                    {b.previewUrl} <ExternalLink className="h-3 w-3" aria-label="opens in a new tab" />
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                {role === "LEAD" && (b.status === "DRAFT" || b.status === "REJECTED") && <Button size="sm" variant="ghost" onClick={() => removeBuild(b.id, b.name)}>Delete</Button>}
                {engineer && b.status === "DRAFT" && <Button size="sm" variant="primary" loading={busyId === b.id} onClick={() => markReady(b.id)}>Mark ready for review</Button>}
                <Link href={`/app/builds/${b.id}`} className="inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface2">
                  {role === "TESTER_CLIENT" && b.status === "IN_REVIEW" ? "Review and decide" : "Details"}
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {engineer && approvals.data && approvals.data.length > 0 && (
        <Card className="mt-8">
          <h2 className="mb-3 font-semibold">Approval history</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2">When</th><th>Build</th><th>Decision</th><th>Commit</th><th>By</th><th>Note</th></tr></thead>
              <tbody className="divide-y divide-line">
                {approvals.data.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-3 text-muted">{formatDateTime(a.decidedAt)}</td>
                    <td className="pr-3">{a.build?.name}</td>
                    <td className="pr-3"><Badge tone={a.decision === "APPROVED" ? "ok" : "danger"}>{a.decision === "APPROVED" ? "Approved" : "Changes requested"}</Badge></td>
                    <td className="pr-3"><code className="text-xs">{a.commitSha.slice(0, 10)}</code></td>
                    <td className="pr-3">{a.user.name}</td>
                    <td className="text-muted">{a.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <RegisterBuildModal open={creating} onClose={() => setCreating(false)} projectId={project.id} onCreated={() => mutate()} />
    </>
  );
}

function RegisterBuildModal({ open, onClose, projectId, onCreated }: { open: boolean; onClose: () => void; projectId: string; onCreated: () => void }) {
  const toast = useToast();
  const { project } = useProject();
  const [form, setForm] = useState({ name: "", branch: "", commitSha: "", previewUrl: project.stagingUrl ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/projects/${projectId}/builds`, { method: "POST", body: { ...form, previewUrl: form.previewUrl || undefined } });
      toast("Build registered as draft");
      setForm({ name: "", branch: "", commitSha: "", previewUrl: project.stagingUrl ?? "" });
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Register a staging build" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Build name" placeholder="Sprint 3: search" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
        <Field label="Branch" placeholder="release/sprint-3" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} required />
        <Field label="Commit SHA" placeholder="9f8e7d6c5b4a" value={form.commitSha} onChange={(e) => setForm({ ...form, commitSha: e.target.value })} required pattern="[0-9a-fA-F]{7,40}"
          hint="7 to 40 hex characters. The client's approval is recorded against this exact commit." />
        <Field label="Preview URL (optional)" type="url" value={form.previewUrl} onChange={(e) => setForm({ ...form, previewUrl: e.target.value })} />
        {error && <p className="rounded-lg bg-dangersoft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>Register build</Button>
        </div>
      </form>
    </Modal>
  );
}
