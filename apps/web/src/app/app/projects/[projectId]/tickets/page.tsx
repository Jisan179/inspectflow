"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import useSWR from "swr";
import { ArrowDown, ArrowUp, MessageSquare, Plus, Search, Ticket as TicketIcon } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, Field, Loading, Modal, Select, SeverityBadge, StatusBadge, TextArea, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { isEngineer, useProject } from "@/lib/project-context";
import { SEVERITY_LABEL, STATUS_LABEL, type Build, type Paged, type TicketListItem } from "@/lib/types";

export default function TicketsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Tickets />
    </Suspense>
  );
}

function Tickets() {
  const { project, role } = useProject();
  const router = useRouter();
  const params = useSearchParams();
  const engineer = isEngineer(role);

  // Filters live in the URL so a filtered view can be shared or bookmarked.
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const severity = params.get("severity") ?? "";
  const assignee = params.get("assigneeId") ?? "";
  const buildId = params.get("buildId") ?? "";
  const sort = params.get("sort") ?? "createdAt";
  const order = params.get("order") ?? "desc";
  const page = Number(params.get("page") ?? "1");

  const [search, setSearch] = useState(q);
  const [creating, setCreating] = useState(false);
  useEffect(() => setSearch(q), [q]);

  const setParam = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in changes)) next.delete("page");
    router.replace(`?${next.toString()}`);
  };

  const query = new URLSearchParams({ sort, order, page: String(page), limit: "15" });
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  if (severity) query.set("severity", severity);
  if (assignee) query.set("assigneeId", assignee);
  if (buildId) query.set("buildId", buildId);

  const { data, error, isLoading, mutate } = useSWR<Paged<TicketListItem>>(`/projects/${project.id}/tickets?${query}`);
  const members = useSWR<any[]>(engineer ? `/projects/${project.id}/members` : null);
  const builds = useSWR<Build[]>(`/projects/${project.id}/builds`);

  const toggleSort = (field: string) =>
    setParam(sort === field ? { order: order === "asc" ? "desc" : "asc" } : { sort: field, order: "desc" });
  const SortIcon = ({ field }: { field: string }) =>
    sort === field ? (order === "asc" ? <ArrowUp className="h-3 w-3" aria-label="ascending" /> : <ArrowDown className="h-3 w-3" aria-label="descending" />) : null;

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const filtered = !!(q || status || severity || assignee || buildId);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{role === "TESTER_CLIENT" ? "Reports you submitted." : "All tickets in this project."}</p>
        <Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" /> New ticket</Button>
      </div>

      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); setParam({ q: search.trim() }); }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="ticket-search" className="mb-1 block text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" aria-hidden="true" />
              <input id="ticket-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, description or IF-12"
                className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm" />
            </div>
          </div>
          <Select label="Status" value={status} onChange={(e) => setParam({ status: e.target.value })}>
            <option value="">All</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select label="Severity" value={severity} onChange={(e) => setParam({ severity: e.target.value })}>
            <option value="">All</option>
            {Object.entries(SEVERITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          {engineer && (
            <Select label="Assignee" value={assignee} onChange={(e) => setParam({ assigneeId: e.target.value })}>
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {members.data?.filter((m) => m.role !== "TESTER_CLIENT").map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </Select>
          )}
          <Select label="Build" value={buildId} onChange={(e) => setParam({ buildId: e.target.value })}>
            <option value="">All builds</option>
            {builds.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
            <Button type="submit">Search</Button>
            {filtered && <Button type="button" variant="ghost" onClick={() => { setSearch(""); router.replace("?"); }}>Clear filters</Button>}
          </div>
        </form>
      </Card>

      {isLoading && <Loading />}
      {error && <ErrorState error={error} retry={() => mutate()} />}
      {data && data.items.length === 0 && (
        <EmptyState icon={<TicketIcon className="h-8 w-8" />} title={filtered ? "No tickets match your filters" : "No tickets yet"}
          text={filtered ? "Try clearing a filter." : "Reports sent from the widget on the staging site appear here."} />
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-surface2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3"><button onClick={() => toggleSort("number")} className="inline-flex items-center gap-1 font-semibold">Ticket <SortIcon field="number" /></button></th>
                <th className="px-4 py-3"><button onClick={() => toggleSort("severity")} className="inline-flex items-center gap-1 font-semibold">Severity <SortIcon field="severity" /></button></th>
                <th className="px-4 py-3"><button onClick={() => toggleSort("status")} className="inline-flex items-center gap-1 font-semibold">Status <SortIcon field="status" /></button></th>
                <th className="px-4 py-3">Reporter</th>
                {engineer && <th className="px-4 py-3">Assignee</th>}
                <th className="px-4 py-3"><button onClick={() => toggleSort("createdAt")} className="inline-flex items-center gap-1 font-semibold">Created <SortIcon field="createdAt" /></button></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((t) => (
                <tr key={t.id} className="hover:bg-surface2/60">
                  <td className="px-4 py-3">
                    <Link href={`/app/tickets/${t.id}`} className="font-medium hover:text-brand">
                      <span className="text-muted">IF-{t.number}</span> {t.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                      {t.build && <span>{t.build.name}</span>}
                      {t._count.comments > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" aria-hidden="true" />{t._count.comments}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><SeverityBadge value={t.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge value={t.status} /></td>
                  <td className="px-4 py-3">{t.reporter.name}</td>
                  {engineer && <td className="px-4 py-3">{t.assignee?.name ?? <span className="text-muted">Unassigned</span>}</td>}
                  <td className="px-4 py-3 text-muted">{formatDay(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">{data.total} tickets, page {data.page} of {pages}</span>
          <div className="flex gap-2">
            <Button size="sm" disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })}>Previous</Button>
            <Button size="sm" disabled={page >= pages} onClick={() => setParam({ page: String(page + 1) })}>Next</Button>
          </div>
        </div>
      )}

      <NewTicketModal open={creating} onClose={() => setCreating(false)} projectId={project.id} builds={builds.data ?? []} onCreated={() => mutate()} />
    </>
  );
}

function NewTicketModal({ open, onClose, projectId, builds, onCreated }: { open: boolean; onClose: () => void; projectId: string; builds: Build[]; onCreated: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({ title: "", description: "", severity: "MEDIUM", buildId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const t = await api<{ id: string; number: number }>(`/projects/${projectId}/tickets`, {
        method: "POST",
        body: { title: form.title, description: form.description, severity: form.severity, buildId: form.buildId || undefined },
      });
      toast(`Ticket IF-${t.number} created`);
      setForm({ title: "", description: "", severity: "MEDIUM", buildId: "" });
      onCreated();
      onClose();
      router.push(`/app/tickets/${t.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="New ticket" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-muted">For an issue with screenshot and technical details, use the Report issue button on the staging site instead.</p>
        <Field label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={3} maxLength={200} />
        <TextArea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required maxLength={5000} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Severity" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            {Object.entries(SEVERITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select label="Build" value={form.buildId} onChange={(e) => setForm({ ...form, buildId: e.target.value })}>
            <option value="">Latest open build</option>
            {builds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>
        {error && <p className="rounded-lg bg-dangersoft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>Create ticket</Button>
        </div>
      </form>
    </Modal>
  );
}
