const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export const formatDateTime = (iso: string) => dateFmt.format(new Date(iso));
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));

export function timeAgo(iso: string) {
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** Turns an activity-log row into a readable sentence. */
export function describeActivity(a: { action: string; metadata?: any }) {
  const m = a.metadata ?? {};
  switch (a.action) {
    case "ticket.created": return "reported the issue";
    case "ticket.status_changed": return `changed status ${m.from} to ${m.to}`;
    case "ticket.auto_resolved": return `merged PR #${m.prNumber}: ticket resolved automatically${m.mergedBy ? ` (merged by ${m.mergedBy})` : ""}`;
    case "ticket.updated": return `updated ${Object.keys(m).join(", ") || "the ticket"}`;
    case "ticket.git_linked": return `linked ${[m.branch && `branch ${m.branch}`, m.prNumber && `PR #${m.prNumber}`].filter(Boolean).join(" and ")}`;
    case "ticket.marked_duplicate": return `marked as duplicate of IF-${m.of}`;
    case "ticket.commented": return "commented";
    case "build.registered": return `registered build on ${m.branch}`;
    case "build.ready_for_review": return "marked a build ready for review";
    case "build.approved": return `approved build (commit ${String(m.commitSha).slice(0, 7)})`;
    case "build.changes_requested": return `requested changes on build (commit ${String(m.commitSha).slice(0, 7)})`;
    case "project.created": return "created the project";
    case "project.updated": return "updated project settings";
    case "project.key_rotated": return "rotated the widget key";
    case "member.added": return `added a member as ${m.role}`;
    case "member.removed": return `removed a ${m.role}`;
    case "member.role_changed": return `changed a role ${m.from} to ${m.to}`;
    case "github.connected": return `connected repository ${m.repo}`;
    default: return a.action;
  }
}
