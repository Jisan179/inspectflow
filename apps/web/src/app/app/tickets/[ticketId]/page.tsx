"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { ArrowLeft, Bug, Trash2, ExternalLink, GitBranch, GitPullRequest, ImageOff, Maximize2, Send } from "lucide-react";
import { Badge, Button, Card, ErrorState, Field, Loading, Modal, Select, SeverityBadge, StatusBadge, TextArea, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { describeActivity, formatDateTime, timeAgo } from "@/lib/format";
import { SEVERITY_LABEL, type Role, type Severity, type TicketStatus } from "@/lib/types";

interface Detail {
  id: string; projectId: string; number: number; title: string; description: string;
  severity: Severity; status: TicketStatus; pageUrl: string | null; viewport: string | null; userAgent: string | null;
  branch: string | null; prNumber: number | null; createdAt: string; resolvedAt: string | null;
  reporter: { id: string; name: string }; assignee: { id: string; name: string } | null;
  build: { id: string; name: string; branch: string; commitSha: string; status: string } | null;
  duplicateOf: { id: string; number: number; title: string } | null;
  comments: { id: string; body: string; createdAt: string; author: { id: string; name: string } }[];
  annotations: { id: string; type: "ARROW" | "BOX" | "BLUR" }[];
  artifacts: { id: string; url: string }[];
  activities: { id: string; action: string; metadata: any; createdAt: string; actor: { name: string } | null }[];
  events: { id: string; type: "CONSOLE" | "NETWORK" | "ERROR"; method: string | null; url: string | null; statusCode: number | null; durationMs: number | null; message: string | null; stack: string | null; timestamp: string }[];
  myRole: Role; allowedTransitions: TicketStatus[];
}

const ACTION_LABEL: Record<TicketStatus, string> = {
  IN_PROGRESS: "Start work", RESOLVED: "Mark resolved", VERIFIED: "Verify fix", OPEN: "Reopen",
};

export default function TicketPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { data: t, error, isLoading, mutate } = useSWR<Detail>(`/tickets/${ticketId}`);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error.status === 404 ? new Error("Ticket not found, or you do not have access to it.") : error} />;
  if (!t) return null;

  const engineer = t.myRole !== "TESTER_CLIENT";
  return (
    <>
      <Link href={`/app/projects/${t.projectId}/tickets`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to tickets</Link>
      <div className="mb-6">
        <p className="text-sm text-muted">IF-{t.number}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge value={t.status} /><SeverityBadge value={t.severity} />
          {t.duplicateOf && <Link href={`/app/tickets/${t.duplicateOf.id}`}><Badge tone="warn">Duplicate of IF-{t.duplicateOf.number}</Badge></Link>}
          <span className="text-sm text-muted">Reported by {t.reporter.name}, {formatDateTime(t.createdAt)}</span></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card><h2 className="mb-2 font-semibold">Description</h2><p className="whitespace-pre-wrap break-words text-sm">{t.description}</p></Card>
          <Screenshot t={t} />
          {engineer && <Evidence t={t} />}
          <Comments t={t} reload={() => mutate()} />
          <Activity t={t} />
        </div>
        <aside className="space-y-6">
          <StatusPanel t={t} reload={() => mutate()} />
          {engineer && <Triage t={t} reload={() => mutate()} />}
          <Environment t={t} engineer={engineer} />
          {t.myRole === "LEAD" && <DeleteTicket t={t} />}
        </aside>
      </div>
    </>
  );
}

function Screenshot({ t }: { t: Detail }) {
  const [zoom, setZoom] = useState(false);
  const shot = t.artifacts[0];
  const counts = t.annotations.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.type]: (acc[a.type] ?? 0) + 1 }), {});
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Annotated screenshot</h2>
        {shot && <Button size="sm" onClick={() => setZoom(true)}><Maximize2 className="h-4 w-4" aria-hidden="true" /> Enlarge</Button>}
      </div>
      {shot ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot.url} alt={`Screenshot attached to ticket IF-${t.number}`} className="w-full cursor-zoom-in rounded-lg border border-line" onClick={() => setZoom(true)} />
          <p className="mt-2 text-xs text-muted">
            {t.annotations.length === 0 ? "No annotations." : `Annotations: ${Object.entries(counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", ")}.`} Blurred areas were destroyed before upload.
            The image link is private and expires after a few minutes; reload the page for a fresh one.
          </p>
          <Modal open={zoom} title="Screenshot" onClose={() => setZoom(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot.url} alt="Enlarged screenshot" className="w-full rounded-lg border border-line" />
          </Modal>
        </>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-surface2 p-6 text-sm text-muted"><ImageOff className="h-5 w-5" aria-hidden="true" /> This ticket was created manually and has no screenshot.</div>
      )}
    </Card>
  );
}

function Evidence({ t }: { t: Detail }) {
  const [tab, setTab] = useState<"errors" | "network">("errors");
  const errors = t.events.filter((e) => e.type !== "NETWORK");
  const network = t.events.filter((e) => e.type === "NETWORK");
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 font-semibold"><Bug className="h-4 w-4" aria-hidden="true" /> Technical evidence</h2>
      <div role="tablist" className="mb-3 flex gap-1 border-b border-line">
        {([["errors", `Console and errors (${errors.length})`], ["network", `Failed requests (${network.length})`]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={clsx("border-b-2 px-3 py-2 text-sm font-medium", tab === k ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink")}>{label}</button>
        ))}
      </div>
      {tab === "errors" && (errors.length === 0 ? <p className="text-sm text-muted">No console errors or exceptions were captured.</p> : (
        <ul className="space-y-3">
          {errors.map((e) => (
            <li key={e.id} className="rounded-lg border border-line bg-surface2 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2"><Badge tone={e.type === "ERROR" ? "danger" : "warn"}>{e.type === "ERROR" ? "Exception" : "console.error"}</Badge><time className="text-xs text-muted">{formatDateTime(e.timestamp)}</time></div>
              {/* Text is rendered as plain text, so captured content can never run as HTML. */}
              <pre className="whitespace-pre-wrap break-words font-mono text-xs">{e.message}</pre>
              {e.stack && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-muted">{e.stack}</pre>}
            </li>
          ))}
        </ul>
      ))}
      {tab === "network" && (network.length === 0 ? <p className="text-sm text-muted">No failed network requests were captured.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2">Method</th><th>URL</th><th>Status</th><th>Time</th></tr></thead>
            <tbody className="divide-y divide-line">
              {network.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-3 font-mono text-xs">{e.method ?? "GET"}</td>
                  <td className="max-w-[320px] break-all pr-3 font-mono text-xs">{e.url}{e.message && <div className="font-sans text-muted">{e.message}</div>}</td>
                  <td className="pr-3"><Badge tone="danger">{e.statusCode === 0 ? "Failed" : e.statusCode}</Badge></td>
                  <td className="text-muted">{e.durationMs != null ? `${e.durationMs} ms` : "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Card>
  );
}

function Comments({ t, reload }: { t: Detail; reload: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  async function removeComment(id: string) {
    try { await api(`/comments/${id}`, { method: "DELETE" }); reload(); }
    catch (err) { toast((err as Error).message, "error"); }
  }
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try { await api(`/tickets/${t.id}/comments`, { method: "POST", body: { body } }); setBody(""); reload(); }
    catch (err) { toast((err as Error).message, "error"); }
    finally { setBusy(false); }
  }
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Discussion ({t.comments.length})</h2>
      {t.comments.length === 0 && <p className="mb-3 text-sm text-muted">No comments yet.</p>}
      <ul className="mb-4 space-y-3">
        {t.comments.map((c) => (
          <li key={c.id} className="rounded-lg bg-surface2 p-3 text-sm">
            <div className="mb-1 flex items-center justify-between gap-2"><strong>{c.author.name}</strong><span className="flex items-center gap-2"><time className="text-xs text-muted" title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</time>{(c.author.id === user?.id || t.myRole === "LEAD") && <button onClick={() => removeComment(c.id)} aria-label="Delete comment" className="text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>}</span></div>
            <p className="whitespace-pre-wrap break-words">{c.body}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="space-y-2">
        <TextArea label="Add a comment or reply" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
        <Button type="submit" variant="primary" loading={busy} disabled={!body.trim()}><Send className="h-4 w-4" aria-hidden="true" /> Post comment</Button>
      </form>
    </Card>
  );
}

function Activity({ t }: { t: Detail }) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Activity</h2>
      <ol className="space-y-2 border-l border-line pl-4 text-sm">
        {t.activities.map((a) => (
          <li key={a.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            <strong>{a.actor?.name ?? "GitHub"}</strong> {describeActivity(a)}
            <span className="ml-2 text-xs text-muted">{formatDateTime(a.createdAt)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function StatusPanel({ t, reload }: { t: Detail; reload: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<TicketStatus | null>(null);
  async function move(status: TicketStatus) {
    setBusy(status);
    try { await api(`/tickets/${t.id}/status`, { method: "POST", body: { status, note: note || undefined } }); setNote(""); toast(`Status changed to ${status.replace("_", " ").toLowerCase()}`); reload(); }
    catch (err) { toast((err as Error).message, "error"); }
    finally { setBusy(null); }
  }
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Status</h2>
      <div className="mb-3"><StatusBadge value={t.status} /></div>
      {t.allowedTransitions.length === 0 ? (
        <p className="text-sm text-muted">{t.myRole === "TESTER_CLIENT" ? "The development team is working on this. You will be able to verify the fix once it is resolved." : "No status changes are available to you right now."}</p>
      ) : (
        <>
          <TextArea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} />
          <div className="mt-3 flex flex-wrap gap-2">
            {t.allowedTransitions.map((s) => (
              <Button key={s} variant={s === "OPEN" ? "secondary" : "primary"} size="sm" loading={busy === s} onClick={() => move(s)}>{ACTION_LABEL[s]}</Button>
            ))}
          </div>
        </>
      )}
      {t.resolvedAt && t.status !== "OPEN" && <p className="mt-3 text-xs text-muted">Resolved {formatDateTime(t.resolvedAt)}</p>}
    </Card>
  );
}

function Triage({ t, reload }: { t: Detail; reload: () => void }) {
  const toast = useToast();
  const members = useSWR<any[]>(`/projects/${t.projectId}/members`);
  const [branch, setBranch] = useState(t.branch ?? "");
  const [pr, setPr] = useState(t.prNumber ? String(t.prNumber) : "");
  const [linkError, setLinkError] = useState("");

  async function patch(body: Record<string, unknown>) {
    try { await api(`/tickets/${t.id}`, { method: "PATCH", body }); toast("Ticket updated"); reload(); }
    catch (err) { toast((err as Error).message, "error"); }
  }
  async function link(e: React.FormEvent) {
    e.preventDefault(); setLinkError("");
    try {
      await api(`/tickets/${t.id}/link`, { method: "POST", body: { branch: branch || undefined, prNumber: pr ? Number(pr) : undefined } });
      toast("Git link saved"); reload();
    } catch (err) { setLinkError((err as Error).message); }
  }

  return (
    <Card>
      <h2 className="mb-3 font-semibold">Triage</h2>
      <div className="space-y-3">
        <Select label="Assignee" value={t.assignee?.id ?? ""} onChange={(e) => patch({ assigneeId: e.target.value || null })}>
          <option value="">Unassigned</option>
          {members.data?.filter((m) => m.role !== "TESTER_CLIENT").map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
        </Select>
        <Select label="Severity" value={t.severity} onChange={(e) => patch({ severity: e.target.value })}>
          {Object.entries(SEVERITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      <form onSubmit={link} className="mt-4 space-y-3 border-t border-line pt-4">
        <p className="flex items-center gap-2 text-sm font-medium"><GitBranch className="h-4 w-4" aria-hidden="true" /> Branch and pull request</p>
        <Field label="Branch" placeholder="fix/checkout-button" value={branch} onChange={(e) => setBranch(e.target.value)} />
        <Field label="Pull request number" type="number" min={1} placeholder="12" value={pr} onChange={(e) => setPr(e.target.value)} error={linkError} />
        <Button type="submit" size="sm">Save link</Button>
        <p className="text-xs text-muted">When the linked pull request is merged on GitHub, this ticket is resolved automatically.</p>
      </form>
      {(t.branch || t.prNumber) && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {t.branch && <Badge tone="brand"><GitBranch className="mr-1 h-3 w-3" aria-hidden="true" />{t.branch}</Badge>}
          {t.prNumber && <Badge tone="brand"><GitPullRequest className="mr-1 h-3 w-3" aria-hidden="true" />PR #{t.prNumber}</Badge>}
        </p>
      )}
    </Card>
  );
}

function Environment({ t, engineer }: { t: Detail; engineer: boolean }) {
  const rows: [string, React.ReactNode][] = [
    ["Page", t.pageUrl ? <a href={t.pageUrl} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">{t.pageUrl} <ExternalLink className="inline h-3 w-3" aria-label="opens in a new tab" /></a> : "n/a"],
    ["Viewport", t.viewport ?? "n/a"],
    ["Browser", engineer ? <span className="break-words">{t.userAgent ?? "n/a"}</span> : null],
    ["Build", t.build ? <Link href={`/app/builds/${t.build.id}`} className="text-brand hover:underline">{t.build.name} ({t.build.commitSha.slice(0, 7)})</Link> : "None"],
  ];
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Environment</h2>
      <dl className="space-y-2 text-sm">
        {rows.filter(([, v]) => v !== null).map(([k, v]) => (<div key={k}><dt className="text-xs uppercase tracking-wide text-muted">{k}</dt><dd>{v}</dd></div>))}
      </dl>
    </Card>
  );
}

function DeleteTicket({ t }: { t: Detail }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  async function remove() {
    try {
      await api(`/tickets/${t.id}`, { method: "DELETE" });
      toast(`Ticket IF-${t.number} deleted`);
      router.replace(`/app/projects/${t.projectId}/tickets`);
    } catch (err) { toast((err as Error).message, "error"); }
  }
  return (
    <Card className="border-danger/40">
      <h2 className="mb-2 font-semibold text-danger">Delete ticket</h2>
      <p className="mb-3 text-sm text-muted">Removes the ticket, its comments, evidence and stored screenshot.</p>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>Delete ticket</Button>
      <Modal open={open} title="Delete ticket" onClose={() => setOpen(false)}>
        <p className="text-sm">Permanently delete <strong>IF-{t.number}</strong>? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2"><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete permanently</Button></div>
      </Modal>
    </Card>
  );
}
