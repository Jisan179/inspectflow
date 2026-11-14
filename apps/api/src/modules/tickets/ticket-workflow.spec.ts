import { ProjectRole, TicketSeverity, TicketStatus } from "@prisma/client";
import { allowedTransitions, canTransition, isBlocking } from "./ticket-workflow";

const { OPEN, IN_PROGRESS, RESOLVED, VERIFIED } = TicketStatus;
const { DEVELOPER, LEAD, TESTER_CLIENT } = ProjectRole;

describe("ticket workflow", () => {
  it("lets developers start and resolve work", () => {
    expect(canTransition(OPEN, IN_PROGRESS, DEVELOPER)).toBe(true);
    expect(canTransition(IN_PROGRESS, RESOLVED, DEVELOPER)).toBe(true);
  });

  it("does not let developers verify their own fixes", () => {
    expect(canTransition(RESOLVED, VERIFIED, DEVELOPER)).toBe(false);
  });

  it("lets testers verify or reopen a resolved ticket", () => {
    expect(canTransition(RESOLVED, VERIFIED, TESTER_CLIENT)).toBe(true);
    expect(canTransition(RESOLVED, OPEN, TESTER_CLIENT)).toBe(true);
    expect(canTransition(VERIFIED, OPEN, TESTER_CLIENT)).toBe(true);
  });

  it("does not let testers start or resolve work", () => {
    expect(canTransition(OPEN, IN_PROGRESS, TESTER_CLIENT)).toBe(false);
    expect(canTransition(IN_PROGRESS, RESOLVED, TESTER_CLIENT)).toBe(false);
  });

  it("forbids skipping the lifecycle", () => {
    expect(canTransition(OPEN, VERIFIED, LEAD)).toBe(false);
    expect(canTransition(IN_PROGRESS, VERIFIED, LEAD)).toBe(false);
  });

  it("lists the moves a role may make", () => {
    expect(allowedTransitions(OPEN, DEVELOPER).sort()).toEqual(
      [IN_PROGRESS, RESOLVED].sort(),
    );
    expect(allowedTransitions(OPEN, TESTER_CLIENT)).toEqual([]);
    expect(allowedTransitions(RESOLVED, TESTER_CLIENT).sort()).toEqual(
      [OPEN, VERIFIED].sort(),
    );
  });

  describe("blocking tickets", () => {
    it("High and Blocker block until verified", () => {
      expect(isBlocking({ severity: TicketSeverity.HIGH, status: OPEN })).toBe(true);
      expect(isBlocking({ severity: TicketSeverity.BLOCKER, status: RESOLVED })).toBe(true);
      expect(isBlocking({ severity: TicketSeverity.HIGH, status: VERIFIED })).toBe(false);
    });

    it("Low and Medium never block", () => {
      expect(isBlocking({ severity: TicketSeverity.LOW, status: OPEN })).toBe(false);
      expect(isBlocking({ severity: TicketSeverity.MEDIUM, status: OPEN })).toBe(false);
    });
  });
});
