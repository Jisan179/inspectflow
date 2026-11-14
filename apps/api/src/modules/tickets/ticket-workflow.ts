import { Prisma, ProjectRole, TicketSeverity, TicketStatus } from "@prisma/client";

const { TESTER_CLIENT, DEVELOPER, LEAD } = ProjectRole;

/**
 * Ticket lifecycle: Open -> In Progress -> Resolved -> Verified, with reopening.
 * Each allowed move lists the project roles that may perform it, so the
 * permission check for every transition lives in this one table.
 *
 * - Developers and Leads do the work (start, resolve).
 * - Testers and Leads confirm the fix (verify) or reject it (reopen).
 * - The GitHub webhook resolves tickets itself (see GithubService).
 */
export const TRANSITIONS: Record<
  TicketStatus,
  Partial<Record<TicketStatus, ProjectRole[]>>
> = {
  OPEN: {
    IN_PROGRESS: [DEVELOPER, LEAD],
    RESOLVED: [DEVELOPER, LEAD],
  },
  IN_PROGRESS: {
    OPEN: [DEVELOPER, LEAD],
    RESOLVED: [DEVELOPER, LEAD],
  },
  RESOLVED: {
    VERIFIED: [TESTER_CLIENT, LEAD],
    OPEN: [TESTER_CLIENT, LEAD],
  },
  VERIFIED: {
    OPEN: [TESTER_CLIENT, LEAD],
  },
};

export function canTransition(
  from: TicketStatus,
  to: TicketStatus,
  role: ProjectRole,
): boolean {
  return TRANSITIONS[from]?.[to]?.includes(role) ?? false;
}

/** Statuses the given role may move a ticket to from its current status. */
export function allowedTransitions(
  from: TicketStatus,
  role: ProjectRole,
): TicketStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [TicketStatus, ProjectRole[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([to]) => to);
}

/**
 * A ticket blocks build approval while it is High or Blocker severity and has
 * not been verified by a tester. Resolved but unverified still blocks, which
 * forces the verification step before sign-off.
 */
export const BLOCKING_SEVERITIES: TicketSeverity[] = [
  TicketSeverity.HIGH,
  TicketSeverity.BLOCKER,
];

export const blockingWhere: Prisma.TicketWhereInput = {
  severity: { in: BLOCKING_SEVERITIES },
  status: { not: TicketStatus.VERIFIED },
};

export const isBlocking = (t: {
  severity: TicketSeverity;
  status: TicketStatus;
}) => BLOCKING_SEVERITIES.includes(t.severity) && t.status !== "VERIFIED";
