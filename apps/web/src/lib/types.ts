export type Role = "TESTER_CLIENT" | "DEVELOPER" | "LEAD";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "BLOCKER";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "VERIFIED";
export type BuildStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export const ROLE_LABEL: Record<Role, string> = {
  LEAD: "Project Lead",
  DEVELOPER: "Developer",
  TESTER_CLIENT: "Tester / Client",
};
export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  VERIFIED: "Verified",
};
export const SEVERITY_LABEL: Record<Severity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  BLOCKER: "Blocker",
};
export const BUILD_LABEL: Record<BuildStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  REJECTED: "Changes requested",
};

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  stagingUrl: string | null;
  apiKeyPrefix: string;
  allowedOrigins: string[];
  githubRepo: string | null;
  hasWebhookSecret: boolean;
  myRole: Role;
  createdAt: string;
  widgetKey?: string;
}

export interface TicketListItem {
  id: string;
  number: number;
  title: string;
  severity: Severity;
  status: TicketStatus;
  createdAt: string;
  reporter: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  build: { id: string; name: string; branch: string } | null;
  _count: { comments: number };
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Build {
  id: string;
  projectId: string;
  name: string;
  branch: string;
  commitSha: string;
  previewUrl: string | null;
  status: BuildStatus;
  createdAt: string;
  blockingTickets?: number;
  _count?: { tickets: number };
}

export interface Approval {
  id: string;
  decision: "APPROVED" | "CHANGES_REQUESTED";
  note: string | null;
  commitSha: string;
  decidedAt: string;
  user: { id: string; name: string };
  build?: { id: string; name: string; branch: string };
}
