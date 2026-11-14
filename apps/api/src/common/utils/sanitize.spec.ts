import {
  MAX_EVENTS,
  sanitizeEvent,
  sanitizeEvents,
  sanitizeText,
  sanitizeUrl,
} from "./sanitize";

describe("log sanitisation", () => {
  describe("sanitizeText", () => {
    it("removes bearer tokens", () => {
      const out = sanitizeText("Authorization failed: Bearer abc.DEF-123_xyz");
      expect(out).not.toContain("abc.DEF-123_xyz");
      expect(out).toContain("Bearer [REDACTED]");
    });

    it("removes JWTs", () => {
      const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJl";
      const out = sanitizeText(`token was ${jwt} ok`);
      expect(out).not.toContain(jwt);
      expect(out).toContain("[REDACTED_JWT]");
    });

    it.each([
      ['password=hunter2&x=1', "hunter2"],
      ['{"password":"hunter2"}', "hunter2"],
      ["cookie: session=abc123secret", "abc123secret"],
      ["api_key = 'sk_live_999'", "sk_live_999"],
      ["refresh_token: r3fr3sh", "r3fr3sh"],
    ])("removes secret values in %s", (input, secret) => {
      expect(sanitizeText(input)).not.toContain(secret);
    });

    it("keeps harmless text", () => {
      expect(sanitizeText("Cannot read properties of undefined")).toBe(
        "Cannot read properties of undefined",
      );
    });

    it("truncates very long text", () => {
      expect(sanitizeText("x".repeat(5000), 100).length).toBeLessThan(130);
    });
  });

  describe("sanitizeUrl", () => {
    it("redacts sensitive query params and keeps others", () => {
      const out = sanitizeUrl("https://a.test/pay?token=SECRET&page=2&apikey=K")!;
      expect(out).not.toContain("SECRET");
      expect(out).not.toContain("apikey=K");
      expect(out).toContain("page=2");
    });

    it("removes credentials and the fragment", () => {
      const out = sanitizeUrl("https://user:pass@a.test/x#access_token=abc")!;
      expect(out).not.toContain("pass");
      expect(out).not.toContain("access_token");
    });

    it("handles relative URLs", () => {
      expect(sanitizeUrl("/api/orders?session=zzz&x=1")).toBe(
        "/api/orders?session=%5BREDACTED%5D&x=1",
      );
    });

    it("returns null for empty input", () => {
      expect(sanitizeUrl("")).toBeNull();
      expect(sanitizeUrl(undefined)).toBeNull();
    });
  });

  describe("sanitizeEvent(s)", () => {
    it("rejects unknown event types and non-objects", () => {
      expect(sanitizeEvent({ type: "HACK" })).toBeNull();
      expect(sanitizeEvent("string")).toBeNull();
      expect(sanitizeEvent(null)).toBeNull();
    });

    it("normalises a network event", () => {
      const e = sanitizeEvent({
        type: "NETWORK",
        method: "post",
        url: "https://a.test/api?token=abc",
        statusCode: 500,
        durationMs: 120,
        message: "Authorization: Bearer abc.def.ghi failed",
      })!;
      expect(e.method).toBe("POST");
      expect(e.url).not.toContain("abc");
      expect(e.message).not.toContain("abc.def.ghi");
      expect(e.statusCode).toBe(500);
    });

    it("clamps invalid numbers and ignores bad methods", () => {
      const e = sanitizeEvent({ type: "NETWORK", method: "EVIL", statusCode: 99999 })!;
      expect(e.method).toBeNull();
      expect(e.statusCode).toBe(999);
    });

    it("keeps script tags as inert text (escaped at render time)", () => {
      const e = sanitizeEvent({ type: "CONSOLE", message: "<script>alert(1)</script>" })!;
      expect(e.message).toBe("<script>alert(1)</script>");
    });

    it("caps the number of events", () => {
      const many = Array.from({ length: MAX_EVENTS + 50 }, () => ({
        type: "CONSOLE",
        message: "x",
      }));
      expect(sanitizeEvents(many)).toHaveLength(MAX_EVENTS);
    });

    it("returns an empty list for non-arrays", () => {
      expect(sanitizeEvents("nope")).toEqual([]);
    });
  });
});
