import { computeSignature, isValidSignature } from "./github.service";

describe("GitHub webhook signature (HMAC-SHA256)", () => {
  const secret = "topsecret-webhook";
  const body = Buffer.from('{"action":"closed","number":7}');

  it("computes the documented sha256= format", () => {
    expect(computeSignature(secret, body)).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("matches a known GitHub test vector", () => {
    // From GitHub docs: secret "It's a Secret to Everybody", body "Hello, World!"
    expect(computeSignature("It's a Secret to Everybody", "Hello, World!")).toBe(
      "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17",
    );
  });

  it("accepts a correct signature", () => {
    expect(isValidSignature(secret, body, computeSignature(secret, body))).toBe(true);
  });

  it("rejects a signature made with another secret", () => {
    expect(isValidSignature(secret, body, computeSignature("other", body))).toBe(false);
  });

  it("rejects when the body was modified", () => {
    const sig = computeSignature(secret, body);
    expect(isValidSignature(secret, Buffer.from('{"action":"closed","number":8}'), sig)).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    expect(isValidSignature(secret, body, undefined)).toBe(false);
    expect(isValidSignature(secret, body, "sha256=")).toBe(false);
    expect(isValidSignature(secret, body, "garbage")).toBe(false);
  });
});
