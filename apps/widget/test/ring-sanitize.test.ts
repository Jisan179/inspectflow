import { RingBuffer } from "../src/ring-buffer";
import { sanitizeText, sanitizeUrl } from "../src/sanitize";

describe("RingBuffer", () => {
  it("keeps only the most recent items (bounded memory)", () => {
    const rb = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => rb.push(n));
    expect(rb.toArray()).toEqual([3, 4, 5]);
    expect(rb.size).toBe(3);
  });

  it("returns a copy, not the internal array", () => {
    const rb = new RingBuffer<number>(2);
    rb.push(1);
    rb.toArray().push(99);
    expect(rb.toArray()).toEqual([1]);
  });

  it("rejects an invalid capacity", () => {
    expect(() => new RingBuffer(0)).toThrow();
  });
});

describe("client-side sanitisation", () => {
  it("removes bearer tokens, JWTs and password values", () => {
    expect(sanitizeText("Bearer abc123.def")).toBe("Bearer [REDACTED]");
    expect(sanitizeText("x eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln y")).toContain("[REDACTED_JWT]");
    expect(sanitizeText("password=hunter2")).not.toContain("hunter2");
    expect(sanitizeText('{"api_key":"sk_123"}')).not.toContain("sk_123");
  });

  it("redacts sensitive query params and drops credentials and hash", () => {
    const out = sanitizeUrl("https://u:p@a.test/x?token=SECRET&page=1#frag");
    expect(out).not.toContain("SECRET");
    expect(out).not.toContain("u:p");
    expect(out).not.toContain("frag");
    expect(out).toContain("page=1");
  });
});
