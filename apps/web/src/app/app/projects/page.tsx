"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { FolderKanban, Plus } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, Field, Loading, Modal, PageHeader, RoleBadge, TextArea, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDay } from "@/lib/format";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const { data, error, isLoading, mutate } = useSWR<Project[]>("/projects");
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Projects you belong to. Your permissions depend on your role in each one."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" /> New project</Button>}
      />
      {isLoading && <Loading />}
      {error && <ErrorState error={error} retry={() => mutate()} />}
      {data && data.length === 0 && (
        <EmptyState icon={<FolderKanban className="h-8 w-8" />} title="No projects yet"
          text="Create a project to get a widget key, or ask a Project Lead to add you to theirs."
          action={<Button variant="primary" onClick={() => setCreating(true)}>Create your first project</Button>} />
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((p) => (
          <Link key={p.id} href={`/app/projects/${p.id}`} className="block rounded-xl focus-visible:outline-offset-4">
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-semibold">{p.name}</h2>
                <RoleBadge value={p.myRole} />
              </div>
              <p className="line-clamp-2 min-h-10 text-sm text-muted">{p.description || "No description"}</p>
              <p className="mt-3 text-xs text-muted">Created {formatDay(p.createdAt)}{p.githubRepo ? ` · ${p.githubRepo}` : ""}</p>
            </Card>
          </Link>
        ))}
      </div>
      <CreateProjectModal open={creating} onClose={() => setCreating(false)} onCreated={() => mutate()} />
    </>
  );
}

function CreateProjectModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stagingUrl, setStagingUrl] = useState("");
  const [origins, setOrigins] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Project | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const allowedOrigins = origins.split(/[\s,]+/).map((o) => o.trim()).filter(Boolean);
      const project = await api<Project>("/projects", {
        method: "POST",
        body: { name, description: description || undefined, stagingUrl: stagingUrl || undefined, allowedOrigins },
      });
      setCreated(project);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function done() {
    const id = created?.id;
    setCreated(null); setName(""); setDescription(""); setStagingUrl(""); setOrigins("");
    onClose();
    if (id) router.push(`/app/projects/${id}/settings`);
  }

  if (created) {
    return (
      <Modal open={open} title="Project created" onClose={done}>
        <p className="text-sm">Copy your widget key now. For security it is stored hashed and cannot be shown again (you can rotate it in project settings).</p>
        <code className="mt-3 block break-all rounded-lg bg-surface2 p-3 text-sm">{created.widgetKey}</code>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => { navigator.clipboard?.writeText(created.widgetKey ?? ""); toast("Key copied"); }}>Copy key</Button>
          <Button variant="primary" onClick={done}>Continue to settings</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} title="New project" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Project name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} />
        <TextArea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        <Field label="Staging site URL (optional)" type="url" placeholder="https://staging.example.com" value={stagingUrl} onChange={(e) => setStagingUrl(e.target.value)} />
        <Field label="Allowed widget origins" placeholder="https://staging.example.com" value={origins} onChange={(e) => setOrigins(e.target.value)}
          hint="Websites allowed to send reports, separated by spaces or commas. Scheme and host only, no path." />
        {error && <p className="rounded-lg bg-dangersoft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>Create project</Button>
        </div>
      </form>
    </Modal>
  );
}
