"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { ErrorState, Loading, RoleBadge } from "@/components/ui";
import { ProjectContext } from "@/lib/project-context";
import type { Project } from "@/lib/types";

/** Shared header and tabs for every page of one project. Tabs depend on the role. */
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const { data: project, error, mutate } = useSWR<Project>(`/projects/${projectId}`);

  if (error) {
    return (
      <>
        <Link href="/app/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Projects</Link>
        <ErrorState error={error.status === 404 ? new Error("Project not found, or you are not a member of it.") : error} />
      </>
    );
  }
  if (!project) return <Loading />;

  const base = `/app/projects/${project.id}`;
  const role = project.myRole;
  const tabs = [
    { href: base, label: "Overview", show: true, exact: true },
    { href: `${base}/tickets`, label: role === "TESTER_CLIENT" ? "My reports" : "Tickets", show: true },
    { href: `${base}/builds`, label: role === "TESTER_CLIENT" ? "Build review" : "Builds", show: true },
    { href: `${base}/members`, label: "Members", show: true },
    { href: `${base}/settings`, label: "Settings", show: role === "LEAD" },
  ].filter((t) => t.show);

  return (
    <ProjectContext.Provider value={{ project, role, reload: () => void mutate() }}>
      <Link href="/app/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All projects
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <RoleBadge value={role} />
      </div>
      <nav aria-label="Project sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
              className={clsx("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink")}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </ProjectContext.Provider>
  );
}
