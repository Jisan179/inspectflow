"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { ArrowLeft, CheckCircle2, ExternalLink, GitBranch, ShieldAlert, XCircle } from "lucide-react";
import { Badge, BuildBadge, Button, Card, ErrorState, Loading, Modal, SeverityBadge, StatusBadge, TextArea, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Approval, Build, Role, Severity, TicketStatus } from "@/lib/types";

interface TicketRef { id: string; number: number; title: string; severity: Severity; status: TicketStatus }
interface Review {
  build: Build; myRole: Role; blockingTickets: TicketRef[]; openTickets: TicketRef[]; verifiedCount: number;
  approvals: Approval[]; canDecide: boolean; canApprove: boolean;
}

/** Client build review: see what is still open, then approve or request changes. */
export default function BuildReviewPage() {
  const { buildId } = useParams<{ buildId: string }>();
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<Review>(`/builds/${buildId}/review`);
  const [choice, setChoice] = useState<"APPROVED" | "CHANGES_REQUESTED" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error.status === 404 ? new Error("Build not found, or it has not been shared with you yet.") : error} />;
  if (!data) return null;
  const { build } = data;
  const engineer = data.myRole !== "TESTER_CLIENT";

  async function submit() {
    if (!choice) return;
    setBusy(true); setFormError("");
    try {
      await api(`/builds/${buildId}/decision`, { method: "POST", body: { decision: choice, note: note.trim() || undefined } });
      toast(choice === "APPROVED" ? "Build approved. Your decision was recorded." : "Changes requested. The team has been informed.");
      setChoice(null); setNote("");
      await mutate();
    } catch (err) { setFormError((err as Error).message); }
    finally { setBusy(false); }
  }

  const TicketList = ({ items, empty }: { items: TicketRef[]; empty: string }) =>
    items.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
      <ul className="divide-y divide-line">
        {items.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            {engineer ? <Link href={`/app/tickets/${t.id}`} className="font-medium hover:text-brand">IF-{t.number} {t.title}</Link> : <span className="font-medium">IF-{t.number} {t.title}</span>}
            <span className="flex gap-2"><SeverityBadge value={t.severity} /><StatusBadge value={t.status} /></span>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <Link href={`/app/projects/${build.projectId}/builds`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to builds</Link>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{build.name}</h1><BuildBadge value={build.status} /></div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1"><GitBranch className="h-4 w-4" aria-hidden="true" />{build.branch}</span>
          <span>commit <code className="rounded bg-surface2 px-1.5 text-xs text-ink">{build.commitSha}</code></span>
          <span>Registered {formatDateTime(build.createdAt)}</span>
        </p>
        {build.previewUrl && <a href={build.previewUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Open the staging build <ExternalLink className="h-3 w-3" aria-label="opens in a new tab" /></a>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-1 flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4 text-danger" aria-hidden="true" /> Blocking tickets ({data.blockingTickets.length})</h2>
            <p className="mb-3 text-sm text-muted">High and Blocker issues must be fixed and verified before this build can be approved.</p>
            <TicketList items={data.blockingTickets} empty="No blocking tickets. This build can be approved." />
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">All open tickets ({data.openTickets.length})</h2>
            <TicketList items={data.openTickets} empty="Everything reported for this build has been verified." />
            <p className="mt-3 text-xs text-muted">{data.verifiedCount} ticket(s) already verified.</p>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Decision history</h2>
            {data.approvals.length === 0 ? <p className="text-sm text-muted">No decision has been recorded for this build.</p> : (
              <ul className="space-y-3">
                {data.approvals.map((a) => (
                  <li key={a.id} className="rounded-lg bg-surface2 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={a.decision === "APPROVED" ? "ok" : "danger"}>{a.decision === "APPROVED" ? "Approved" : "Changes requested"}</Badge>
                      <span>by <strong>{a.user.name}</strong> on {formatDateTime(a.decidedAt)}</span>
                    </div>
                    <p className="mt-1 text-muted">Commit <code className="text-xs">{a.commitSha}</code></p>
                    {a.note && <p className="mt-1 whitespace-pre-wrap">{a.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside>
          <Card>
            <h2 className="mb-3 font-semibold">Your decision</h2>
            {data.canDecide ? (
              <div className="space-y-3">
                {!data.canApprove && <p className="rounded-lg bg-warnsoft px-3 py-2 text-sm text-warn">Approval is blocked until the {data.blockingTickets.length} blocking ticket(s) are verified. You can still request changes.</p>}
                <TextArea label="Note (required when requesting changes)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                <div className="flex flex-col gap-2">
                  <Button variant="primary" disabled={!data.canApprove} onClick={() => setChoice("APPROVED")}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve build</Button>
                  <Button onClick={() => { if (!note.trim()) { setFormError("Please write a note that says what needs to change."); return; } setFormError(""); setChoice("CHANGES_REQUESTED"); }}><XCircle className="h-4 w-4" aria-hidden="true" /> Request changes</Button>
                </div>
                {formError && !choice && <p className="text-sm text-danger" role="alert">{formError}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted">
                {build.status === "IN_REVIEW" ? "Only a Tester / Client of this project can approve or request changes." : `This build is ${build.status === "APPROVED" ? "approved" : build.status === "REJECTED" ? "closed with requested changes" : "not in review"}, so no further decision is possible.`}
              </p>
            )}
          </Card>
        </aside>
      </div>

      <Modal open={!!choice} title={choice === "APPROVED" ? "Confirm approval" : "Confirm change request"} onClose={() => setChoice(null)}>
        <p className="text-sm">
          {choice === "APPROVED"
            ? <>You are approving <strong>{build.name}</strong> at commit <code>{build.commitSha.slice(0, 10)}</code>. This is recorded with your name and the time, and cannot be changed.</>
            : <>You are asking the team to change <strong>{build.name}</strong>. This closes the build; the team will register a new one.</>}
        </p>
        {formError && <p className="mt-3 rounded-lg bg-dangersoft px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setChoice(null)}>Cancel</Button>
          <Button variant={choice === "APPROVED" ? "primary" : "danger"} loading={busy} onClick={submit}>{choice === "APPROVED" ? "Approve" : "Request changes"}</Button>
        </div>
      </Modal>
    </>
  );
}
