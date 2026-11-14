import Link from "next/link";
import { Camera, FileSearch, GitMerge, Lock, ShieldCheck, Server, ArrowRight, MousePointerClick, PenLine, Ticket, BadgeCheck } from "lucide-react";
import { Logo } from "@/components/ui";

const steps = [
  { icon: MousePointerClick, title: "Tester clicks Report issue", text: "One script tag on the staging site adds a button. No account on a third-party tool, no technical vocabulary." },
  { icon: PenLine, title: "Draw, blur, send", text: "Arrows and boxes point at the problem. Blur hides private data before the image ever leaves the browser." },
  { icon: Ticket, title: "Ticket with real evidence", text: "Page URL, browser, screen size, console errors and failed requests arrive attached to the ticket automatically." },
  { icon: GitMerge, title: "Merge closes the loop", text: "Link a branch or pull request. When GitHub reports the merge, the ticket moves to Resolved on its own." },
];

const features = [
  { icon: Camera, title: "Annotated screenshots", text: "Capture the page, then mark it up with arrows, boxes and irreversible blur." },
  { icon: FileSearch, title: "Failed-request viewer", text: "See the exact 500 response, method and URL behind a vague report like checkout is not working." },
  { icon: GitMerge, title: "GitHub linked", text: "Signed webhooks resolve tickets when the linked pull request merges. Replays are ignored." },
  { icon: BadgeCheck, title: "Formal build sign-off", text: "Clients approve a specific commit. Builds with blocking tickets cannot be approved." },
  { icon: Lock, title: "Privacy by design", text: "Tokens, cookies and passwords are stripped. Screenshots live in private storage behind expiring links." },
  { icon: Server, title: "Free and self-hostable", text: "Node, PostgreSQL and any S3-compatible bucket. Runs on free tiers for small teams." },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3" aria-label="Main">
          <Link href="/" aria-label="InspectFlow home"><Logo /></Link>
          <div className="flex items-center gap-1 text-sm">
            <a href="#how" className="hidden rounded-lg px-3 py-2 text-muted hover:text-ink sm:block">How it works</a>
            <a href="#features" className="hidden rounded-lg px-3 py-2 text-muted hover:text-ink sm:block">Features</a>
            <Link href="/login" className="rounded-lg px-3 py-2 font-medium hover:bg-surface2">Sign in</Link>
            <Link href="/register" className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brandstrong">Get started</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 md:grid-cols-2 md:pt-20">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brandsoft px-3 py-1 text-xs font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Visual staging QA and PR sign-off
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Bug reports your developers can actually reproduce.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted">
              InspectFlow turns a client&apos;s &ldquo;the button is not working&rdquo; into a ticket with a
              screenshot, console errors and the failing API call, then ties it to the pull request that fixes it and to the
              build the client finally approves.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-medium text-white hover:bg-brandstrong">
                Create a project <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="inline-flex items-center rounded-lg border border-line bg-surface px-5 py-3 font-medium hover:bg-surface2">
                Try the demo accounts
              </Link>
            </div>
          </div>

          {/* Illustration of what a ticket contains (static, not live data) */}
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-lg" aria-hidden="true">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Example ticket</span>
              <span className="rounded-full bg-warnsoft px-2.5 py-0.5 text-xs font-medium text-warn">High</span>
            </div>
            <div className="relative mb-3 h-40 overflow-hidden rounded-lg border border-line bg-surface2">
              <div className="h-7 bg-[#1f2a44]" />
              <div className="p-4"><div className="h-3 w-1/2 rounded bg-line" /><div className="mt-3 h-3 w-2/3 rounded bg-line" />
                <div className="mt-5 inline-block rounded-md bg-brand px-4 py-2 text-xs text-white">Pay now</div></div>
              <div className="absolute left-4 top-[88px] h-12 w-28 rounded-md border-4 border-[#e5484d]" />
              <div className="absolute right-6 top-14 h-5 w-24 rounded bg-slate-500/70 backdrop-blur" />
            </div>
            <p className="font-semibold">Pay now button does nothing</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
              <dt>Viewport</dt><dd className="text-ink">360 x 640</dd>
              <dt>Console</dt><dd className="text-ink">TypeError: reading &apos;submit&apos;</dd>
              <dt>Request</dt><dd className="text-ink">POST /api/orders 500</dd>
              <dt>Linked</dt><dd className="text-ink">fix/pay-button</dd>
            </dl>
          </div>
        </section>

        <section id="how" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center text-3xl font-bold tracking-tight">From report to sign-off in four steps</h2>
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-xl border border-line bg-bg p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brandsoft text-brand"><s.icon className="h-5 w-5" aria-hidden="true" /></span>
                    <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">Everything a small team needs</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted">Built for web agencies, freelancers and student project teams who test on a staging server before launch.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-line bg-surface p-5">
                <f.icon className="mb-3 h-6 w-6 text-brand" aria-hidden="true" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="rounded-2xl bg-[#1f2a44] px-6 py-12 text-center text-white">
            <h2 className="text-3xl font-bold tracking-tight">Ready to stop chasing screenshots on WhatsApp?</h2>
            <p className="mx-auto mt-2 max-w-xl text-slate-300">Create a project, paste one script tag and send your tester the link.</p>
            <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-medium text-[#1f2a44] hover:bg-slate-100">
              Get started free <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted">
          <Logo size={22} />
          <p>University software engineering project. Original design, not affiliated with any commercial product.</p>
        </div>
      </footer>
    </div>
  );
}
