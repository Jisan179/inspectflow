import { Collector } from "../src/collector";

describe("Collector", () => {
  let collector: Collector;
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = (window as any).fetch;
  });
  afterEach(() => {
    collector?.uninstall();
    (window as any).fetch = originalFetch;
  });

  it("records console.error without swallowing it", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    collector = new Collector();
    collector.install();
    console.error("Payment failed", new Error("boom"));
    const [e] = collector.snapshot();
    expect(e.type).toBe("CONSOLE");
    expect(e.message).toContain("Payment failed");
    expect(e.stack).toContain("boom");
    spy.mockRestore();
  });

  it("records uncaught exceptions and unhandled rejections", () => {
    collector = new Collector();
    collector.install();
    window.dispatchEvent(new ErrorEvent("error", { message: "Uncaught TypeError: x", error: new TypeError("x") }));
    const rejection = new Event("unhandledrejection") as any;
    rejection.reason = new Error("rejected!");
    window.dispatchEvent(rejection);
    const events = collector.snapshot();
    expect(events.map((e) => e.type)).toEqual(["ERROR", "ERROR"]);
    expect(events[1].message).toContain("rejected!");
  });

  it("records failed fetch calls (HTTP error and network failure) but not successes", async () => {
    (window as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Server Error" })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    collector = new Collector();
    collector.install();

    await fetch("https://shop.test/api/orders?token=SECRET", { method: "post" });
    await fetch("https://shop.test/api/ok");
    await expect(fetch("https://shop.test/api/down")).rejects.toThrow("Failed to fetch");

    const events = collector.snapshot();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "NETWORK", method: "POST", statusCode: 500 });
    expect(events[0].url).not.toContain("SECRET");
    expect(events[1]).toMatchObject({ statusCode: 0 });
  });

  it("never records headers or bodies", async () => {
    (window as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, statusText: "Unauthorized" });
    collector = new Collector();
    collector.install();
    await fetch("https://shop.test/api/me", {
      headers: { Authorization: "Bearer topsecret", Cookie: "sid=abc" },
      body: JSON.stringify({ password: "hunter2" }),
      method: "POST",
    });
    const dump = JSON.stringify(collector.snapshot());
    expect(dump).not.toContain("topsecret");
    expect(dump).not.toContain("sid=abc");
    expect(dump).not.toContain("hunter2");
  });

  it("ignores requests to the InspectFlow API itself", async () => {
    (window as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: "x" });
    collector = new Collector({ ignoreUrlPrefixes: ["https://api.inspectflow.test"] });
    collector.install();
    await fetch("https://api.inspectflow.test/reports");
    expect(collector.snapshot()).toHaveLength(0);
  });

  it("records failed XMLHttpRequest calls", () => {
    // jsdom XHR cannot make real requests, so drive the patched methods directly.
    const listeners: Record<string, () => void> = {};
    const proto = XMLHttpRequest.prototype as any;
    const origOpen = proto.open, origSend = proto.send;
    proto.open = function () {};
    proto.send = function () {};
    collector = new Collector();
    collector.install();

    const xhr: any = Object.create(proto);
    xhr.addEventListener = (n: string, fn: () => void) => (listeners[n] = fn);
    Object.defineProperty(xhr, "status", { value: 404 });
    Object.defineProperty(xhr, "statusText", { value: "Not Found" });
    xhr.open("get", "https://shop.test/missing?apikey=K1");
    xhr.send(null);
    listeners.loadend();

    const [e] = collector.snapshot();
    expect(e).toMatchObject({ type: "NETWORK", method: "GET", statusCode: 404 });
    expect(e.url).not.toContain("K1");

    collector.uninstall();
    proto.open = origOpen; proto.send = origSend;
  });

  it("keeps a bounded rolling buffer", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    collector = new Collector({ capacity: 5 });
    collector.install();
    for (let i = 0; i < 20; i++) console.error(`error ${i}`);
    const events = collector.snapshot();
    expect(events).toHaveLength(5);
    expect(events[0].message).toBe("error 15");
    spy.mockRestore();
  });

  it("uninstall restores the original functions", () => {
    const before = console.error;
    collector = new Collector();
    collector.install();
    expect(console.error).not.toBe(before);
    collector.uninstall();
    expect(console.error).toBe(before);
  });

  it("counts errors and failed requests for the tester summary", async () => {
    (window as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: "" });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    collector = new Collector();
    collector.install();
    console.error("a");
    await fetch("https://x.test/a");
    expect(collector.counts()).toEqual({ errors: 1, failedRequests: 1 });
    spy.mockRestore();
  });
});
