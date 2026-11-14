"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { Badge, Button, Card, ErrorState, Field, Loading, Modal, PageHeader, TextArea, useToast } from "@/components/ui";
import { API_URL, WEB_URL, api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useProject } from "@/lib/project-context";
import type { Paged } from "@/lib/types";

export default function SettingsPage() {
  const { project, role } = useProject();
  if (role !== "LEAD") return <ErrorState error={new Error("Only the Project Lead can open settings.")} />;
  return (
    <>
      <PageHeader title="Project settings" subtitle="Widget key, allowed websites, GitHub connection and project details." />
      <div className="space-y-6">
        <DetailsCard />
        <WidgetCard key={project.apiKeyPrefix} />
        <GithubCard />
        <DangerCard />
      </div>
    </>
  );
}

function DetailsCard() {
  const { project, reload } = useProject();
  const toast = useToast();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [stagingUrl, setStagingUrl] = useState(project.stagingUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api(`/projects/${project.id}`, { method: "PATCH", body: { name, description, stagingUrl: stagingUrl || undefined } });
      toast("Project updated");
      reload();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <h2 className="mb-4 font-semibold">Details</h2>
      <form onSubmit={save} className="space-y-4">
        <Field label="Project name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        <Field label="Staging site URL" type="url" value={stagingUrl} onChange={(e) => setStagingUrl(e.target.value)} />
        {error && <p className="rounded-lg bg-dangersoft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" variant="primary" loading={busy}>Save details</Button>
      </form>
    </Card>
  );
}

function WidgetCard() {
  const { project, reload } = useProject();
  const toast = useToast();
  const [origins, setOrigins] = useState(project.allowedOrigins.join("\n"));
  const [savingOrigins, setSavingOrigins] = useState(false);
  const [originError, setOriginError] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function saveOrigins(e: React.FormEvent) {
    e.preventDefault();
    setSavingOrigins(true); setOriginError("");
    try {
      const list = origins.split(/[\s,]+/).map((o) => o.trim()).filter(Boolean);
      await api(`/projects/${project.id}`, { method: "PATCH", body: { allowedOrigins: list } });
      toast("Allowed origins saved");
      reload();
    } catch (err) { setOriginError((err as Error).message); }
    finally { setSavingOrigins(false); }
  }

  async function rotate() {
    try {
      const res = await api<{ widgetKey: string }>(`/projects/${project.id}/rotate-key`, { method: "POST" });
      setNewKey(res.widgetKey);
      setConfirming(false);
      reload();
    } catch (err) { toast((err as Error).message, "error"); }
  }

  const snippet = `<script src="${WEB_URL}/inspectflow-widget.js"\n        data-key="${newKey ?? "YOUR_WIDGET_KEY"}"\n        data-api="${API_URL}" defer></script>`;
  const copy = (text: string) => { navigator.clipboard?.writeText(text); toast("Copied"); };

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" aria-hidden="true" /> Widget</h2>
      <p className="mb-4 text-sm text-muted">
        The widget key identifies this project. It is visible in the page source, so treat it as a public ID, not a secret.
        Protection comes from the allowed origins below, rate limits and the tester sign-in.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-surface2 p-3 text-sm">
        <span>Current key starts with <code className="rounded bg-surface px-1.5">{project.apiKeyPrefix}...</code></span>
        <Button size="sm" onClick={() => setConfirming(true)}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Rotate key</Button>
      </div>

      {newKey && (
        <div className="mb-4 rounded-lg border border-ok/40 bg-oksoft p-3 text-sm">
          <p className="font-medium text-ok">New key created. Copy it now; it cannot be shown again.</p>
          <code className="mt-2 block break-all rounded bg-surface p-2">{newKey}</code>
        </div>
      )}

      <p className="mb-1 text-sm font-medium">Embed code for your staging site</p>
      <div className="relative">
        <pre className="overflow-x-auto rounded-lg bg-[#0f1626] p-3 pr-12 text-xs leading-relaxed text-slate-100">{snippet}</pre>
        <button onClick={() => copy(snippet)} aria-label="Copy snippet" className="absolute right-2 top-2 rounded-md bg-white/10 p-1.5 text-white hover:bg-white/20"><Copy className="h-4 w-4" /></button>
      </div>

      <form onSubmit={saveOrigins} className="mt-5 space-y-3">
        <TextArea label="Allowed origins (one per line)" value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder="https://staging.example.com"
          hint="Only these websites can send reports. Use scheme and host only, for example http://localhost:4000 for local testing." error={originError} />
        <Button type="submit" loading={savingOrigins}>Save origins</Button>
      </form>

      <Modal open={confirming} title="Rotate widget key" onClose={() => setConfirming(false)}>
        <p className="text-sm">The old key stops working immediately. Every staging site using it must be updated with the new key.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="danger" onClick={rotate}>Rotate key</Button>
        </div>
      </Modal>
    </Card>
  );
}

function GithubCard() {
  const { project, reload } = useProject();
  const toast = useToast();
  const [repo, setRepo] = useState(project.githubRepo ?? "");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ webhookUrl: string; webhookSecret: string | null } | null>(null);
  const deliveries = useSWR<Paged<any>>(`/projects/${project.id}/webhook-deliveries?limit=10`);

  async function connect(e: React.FormEvent, regenerate = false) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await api<{ webhookUrl: string; webhookSecret: string | null }>(`/projects/${project.id}/github`, {
        method: "PATCH",
        body: { githubRepo: repo, webhookSecret: secret || undefined, regenerateSecret: regenerate || undefined },
      });
      setResult(res); setSecret("");
      toast("GitHub repository saved");
      reload();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">GitHub connection</h2>
      <p className="mb-4 text-sm text-muted">When a pull request linked to a ticket is merged, GitHub notifies InspectFlow and the ticket moves to Resolved.</p>
      <form onSubmit={connect} className="space-y-3">
        <Field label="Repository" placeholder="owner/repository" value={repo} onChange={(e) => setRepo(e.target.value)} required />
        <Field label="Webhook secret (optional)" type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)}
          hint={project.hasWebhookSecret ? "A secret is already stored. Leave empty to keep it." : "Leave empty to generate a strong secret for you."} />
        {error && <p className="rounded-lg bg-dangersoft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" loading={busy}>Save connection</Button>
          {project.hasWebhookSecret && <Button type="button" onClick={(e) => connect(e, true)}>Generate new secret</Button>}
        </div>
      </form>

      {result && (
        <div className="mt-4 rounded-lg border border-line bg-surface2 p-3 text-sm">
          <p className="font-medium">Add this webhook in GitHub: Settings, Webhooks, Add webhook</p>
          <ul className="mt-2 space-y-1">
            <li>Payload URL: <code className="break-all rounded bg-surface px-1.5">{result.webhookUrl}</code></li>
            <li>Content type: <code className="rounded bg-surface px-1.5">application/json</code></li>
            <li>Events: <strong>Pull requests</strong></li>
            {result.webhookSecret && <li>Secret (shown once): <code className="break-all rounded bg-surface px-1.5">{result.webhookSecret}</code></li>}
          </ul>
        </div>
      )}

      <h3 className="mb-2 mt-6 text-sm font-semibold">Recent webhook deliveries</h3>
      {deliveries.isLoading && <Loading />}
      {deliveries.data?.items.length === 0 && <p className="text-sm text-muted">No deliveries yet.</p>}
      {deliveries.data && deliveries.data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2">Received</th><th>Event</th><th>Signature</th><th>Outcome</th></tr></thead>
            <tbody className="divide-y divide-line">
              {deliveries.data.items.map((d: any) => (
                <tr key={d.id}>
                  <td className="py-2 pr-3 text-muted">{formatDateTime(d.processedAt)}</td>
                  <td className="pr-3">{d.event}</td>
                  <td className="pr-3"><Badge tone={d.signatureValid ? "ok" : "danger"}>{d.signatureValid ? "Valid" : "Rejected"}</Badge></td>
                  <td className="text-muted">{d.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function DangerCard() {
  const { project } = useProject();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  async function remove() {
    try {
      await api(`/projects/${project.id}`, { method: "DELETE" });
      toast("Project deleted");
      router.replace("/app/projects");
    } catch (err) { toast((err as Error).message, "error"); }
  }

  return (
    <Card className="border-danger/40">
      <h2 className="mb-1 font-semibold text-danger">Danger zone</h2>
      <p className="mb-3 text-sm text-muted">Deleting the project permanently removes its tickets, builds, approvals and stored screenshots.</p>
      <Button variant="danger" onClick={() => setOpen(true)}>Delete project</Button>
      <Modal open={open} title="Delete project" onClose={() => setOpen(false)}>
        <p className="text-sm">This cannot be undone. Type <strong>{project.name}</strong> to confirm.</p>
        <input aria-label="Type the project name to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" disabled={confirm !== project.name} onClick={remove}>Delete permanently</Button>
        </div>
      </Modal>
    </Card>
  );
}
