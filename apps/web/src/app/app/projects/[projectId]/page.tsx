"use client";

import Link from "next/link";
import useSWR from "swr";
import { ExternalLink, History } from "lucide-react";
import { Badge, BuildBadge, Card, ErrorState, Loading, SeverityBadge, StatusBadge } from "@/components/ui";
import { describeActivity, formatDateTime, timeAgo } from "@/lib/format";
import { isEngineer, useProject } from "@/lib/project-context";
import type { Build, Paged, TicketListItem } from "@/lib/types";

export default function OverviewPage() {
  const { role } = useProject();
  return isEngineer(role) ? <EngineerOverview /> : <TesterOverview />;
}

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <Card className="h-full">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </Card>
  );
  return href ? <Link href={href} className="block rounded-xl">{body}</Link> : body;
}

function EngineerOverview() {
  const { project } = useProject();
  const { data, error, isLoading, mutate } = useSWR<any>(`/projects/${project.id}/overview`);
  const base = `/app/projects/${project.id}`;
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const t = data.tickets;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open" value={t.open} href={`${base}/tickets?status=OPEN`} />
        <Stat label="In progress" value={t.inProgress} href={`${base}/tickets?status=IN_PROGRESS`} />
        <Stat label="Resolved, awaiting verification" value={t.resolved} href={`${base}/tickets?status=RESOLVED`} />
        <Stat label="Verified" value={t.verified} href={`${base}/tickets?status=VERIFIED`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Builds</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {(["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"] as const).map((s) => (
              <div key={s} className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2">
                <dt><BuildBadge value={s} /></dt><dd className="font-semibold">{data.builds[s] ?? 0}</dd>
              </div>
            ))}
          </dl>
          <Link href={`${base}/builds`} className="mt-3 inline-block text-sm font-medium text-brand hover:underline">Manage builds</Link>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Approval history</h2>
          {data.approvals.length === 0 ? <p className="text-sm text-muted">No client decisions yet.</p> : (
            <ul className="space-y-2 text-sm">
              {data.approvals.map((a: any) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.decision === "APPROVED" ? "ok" : "danger"}>{a.decision === "APPROVED" ? "Approved" : "Changes requested"}</Badge>
                  <span>{a.build.name}</span>
                  <code className="rounded bg-surface2 px-1.5 text-xs">{a.commitSha.slice(0, 7)}</code>
                  <span className="text-muted">by {a.user.name}, {timeAgo(a.decidedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><History className="h-4 w-4" aria-hidden="true" /> Recent activity</h2>
        {data.activity.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {data.activity.map((a: any) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><strong>{a.actor?.name ?? "GitHub"}</strong> {describeActivity(a)}
                  {a.ticketId && <Link href={`/app/tickets/${a.ticketId}`} className="ml-2 text-brand hover:underline">View ticket</Link>}</span>
                <time className="text-muted" dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TesterOverview() {
  const { project } = useProject();
  const tickets = useSWR<Paged<TicketListItem>>(`/projects/${project.id}/tickets?limit=5`);
  const builds = useSWR<Build[]>(`/projects/${project.id}/builds`);
  const base = `/app/projects/${project.id}`;
  const review = builds.data?.filter((b) => b.status === "IN_REVIEW") ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-semibold">How to report a problem</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Open the staging website{project.stagingUrl && <> (<a className="inline-flex items-center gap-1 text-brand hover:underline" href={project.stagingUrl} target="_blank" rel="noreferrer">{project.stagingUrl}<ExternalLink className="h-3 w-3" aria-label="opens in a new tab" /></a>)</>}.</li>
          <li>Click the <strong className="text-ink">Report issue</strong> button in the corner and sign in with this account.</li>
          <li>Draw on the screenshot, blur private data, describe the problem and send.</li>
        </ol>
      </Card>

      {review.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Builds waiting for your review</h2>
          <ul className="space-y-2">
            {review.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface2 px-3 py-2 text-sm">
                <span><strong>{b.name}</strong> <span className="text-muted">({b.branch})</span></span>
                <Link href={`/app/builds/${b.id}`} className="font-medium text-brand hover:underline">Review build</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">My latest reports</h2>
          <Link href={`${base}/tickets`} className="text-sm font-medium text-brand hover:underline">View all</Link>
        </div>
        {tickets.isLoading && <Loading />}
        {tickets.data?.items.length === 0 && <p className="text-sm text-muted">You have not reported anything yet.</p>}
        <ul className="divide-y divide-line">
          {tickets.data?.items.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link href={`/app/tickets/${t.id}`} className="font-medium hover:text-brand">IF-{t.number} {t.title}</Link>
              <span className="flex gap-2"><SeverityBadge value={t.severity} /><StatusBadge value={t.status} /></span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
