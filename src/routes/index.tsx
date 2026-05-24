import { createFileRoute, Link } from "@tanstack/react-router";
import { Flag, MonitorPlay, Trophy, Settings, ArrowRight } from "lucide-react";
import { DemoKiosk } from "@/components/DemoKiosk";
import heroImg from "@/assets/landing-hero.jpg";
import plaqueImg from "@/assets/landing-plaque.jpg";
import clubhouseImg from "@/assets/landing-clubhouse.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Ace Board — A clubhouse honor for every hole-in-one" },
      {
        name: "description",
        content:
          "The clubhouse display, public record, and CMS that gives every ace at your course the celebration it deserves.",
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── NAV ─────────────────────────────────────────────────────── */}
      <nav className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-2.5 text-background">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--gradient-brass)] text-primary-deep shadow-md">
              <Flag className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="font-display text-2xl font-semibold tracking-tight">
              Ace Board
            </span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-background/85 md:flex">
            <a href="#display" className="hover:text-background">The Display</a>
            <a href="#record" className="hover:text-background">The Record</a>
            <a href="#demo" className="hover:text-background">Live Demo</a>
          </div>
          <Link
            to="/login"
            className="rounded-full border border-background/30 px-5 py-2 text-sm font-medium text-background backdrop-blur-sm transition hover:bg-background/10"
          >
            Member sign in
          </Link>
        </div>
      </nav>

      {/* ─── HERO ────────────────────────────────────────────────────── */}
      <section className="relative isolate min-h-[92vh] overflow-hidden">
        <img
          src={heroImg}
          alt="Sunrise over a manicured par-3 with mist rising off the green"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          width={1920}
          height={1280}
        />
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-b from-transparent to-background" />

        <div className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-end px-6 pb-24 pt-40">
          <span className="font-sans text-xs uppercase tracking-[0.4em] text-accent">
            · Established for the modern clubhouse ·
          </span>
          <h1 className="mt-6 font-display text-6xl font-medium leading-[0.95] tracking-tight text-background md:text-8xl">
            Every ace,<br />
            <em className="text-accent">enshrined.</em>
          </h1>
          <p className="mt-8 max-w-xl font-sans text-lg leading-relaxed text-background/85">
            Ace Board is the digital honor board your course has been
            waiting for — a clubhouse display, a public record, and a quiet
            piece of software that keeps both perfectly in sync.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-accent-foreground shadow-lg transition hover:bg-accent-deep"
            >
              Open the CMS
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 rounded-full border border-background/40 px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-background transition hover:bg-background/10"
            >
              See the display
            </a>
          </div>
        </div>
      </section>

      {/* ─── MANIFESTO ───────────────────────────────────────────────── */}
      <section className="relative border-y border-border/60 bg-card">
        <div className="mx-auto max-w-5xl px-6 py-28 text-center">
          <span className="font-sans text-xs uppercase tracking-[0.4em] text-accent-deep">
            The tradition
          </span>
          <p className="mt-8 font-display text-3xl font-medium leading-snug tracking-tight text-primary-deep md:text-5xl">
            “One swing in ten thousand finds the cup. It deserves more than
            a photograph behind the bar — it deserves a place on the wall,
            for as long as the wall stands.”
          </p>
          <div className="mx-auto mt-10 flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-accent" />
            <span className="font-sans text-xs uppercase tracking-[0.3em] text-muted-foreground">
              The Ace Board Charter
            </span>
            <span className="h-px w-12 bg-accent" />
          </div>
        </div>
      </section>

      {/* ─── DISPLAY SECTION ─────────────────────────────────────────── */}
      <section id="display" className="relative bg-background">
        <div className="mx-auto grid max-w-7xl gap-16 px-6 py-28 md:grid-cols-2 md:items-center">
          <div className="relative">
            <div
              className="overflow-hidden rounded-sm"
              style={{ boxShadow: "var(--shadow-elegant)" }}
            >
              <img
                src={clubhouseImg}
                alt="Warmly lit clubhouse lounge with the Ace Board display"
                className="aspect-[4/3] w-full object-cover"
                width={1600}
                height={1200}
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 hidden h-32 w-32 rounded-full md:block"
              style={{ background: "var(--gradient-brass)", boxShadow: "var(--shadow-elegant)" }}
            />
          </div>
          <div>
            <span className="font-sans text-xs uppercase tracking-[0.4em] text-accent-deep">
              The Display
            </span>
            <h2 className="mt-4 font-display text-5xl font-medium leading-tight tracking-tight text-primary-deep">
              A fixture in the room,<br />not another app.
            </h2>
            <p className="mt-6 font-sans text-base leading-relaxed text-muted-foreground">
              A fullscreen carousel made for the TV above the bar.
              Per-hole boards, flyovers, top-down maps, and an engraved
              roster of every ace ever recorded. Caches locally, refreshes
              quietly, phones home every minute so you know it's awake.
            </p>
            <ul className="mt-8 space-y-3 font-sans text-sm text-foreground/80">
              <FeatureRow>Walnut, mahogany, slate, or modern-dark plaque skins</FeatureRow>
              <FeatureRow>Per-course colors, logo, and typography</FeatureRow>
              <FeatureRow>Works on any browser, 1080p or 4K</FeatureRow>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── RECORD SECTION (dark) ───────────────────────────────────── */}
      <section
        id="record"
        className="relative text-background"
        style={{ background: "var(--surface-dark)" }}
      >
        <div className="mx-auto grid max-w-7xl gap-16 px-6 py-28 md:grid-cols-2 md:items-center">
          <div className="md:order-2">
            <div
              className="overflow-hidden rounded-sm"
              style={{ boxShadow: "var(--shadow-plaque)" }}
            >
              <img
                src={plaqueImg}
                alt="Engraved brass plaque on dark walnut"
                className="aspect-[4/5] w-full object-cover"
                width={1280}
                height={1600}
                loading="lazy"
              />
            </div>
          </div>
          <div className="md:order-1">
            <span className="font-sans text-xs uppercase tracking-[0.4em] text-accent">
              The Record
            </span>
            <h2 className="mt-4 font-display text-5xl font-medium leading-tight tracking-tight text-background">
              A public record,<br />
              <em className="text-accent">built to last.</em>
            </h2>
            <p className="mt-6 font-sans text-base leading-relaxed text-background/75">
              A branded, searchable hole-in-one page for members, guests,
              and the proud family member three states away. Permanent
              URLs. Open Graph cards that look like the real thing. The
              kind of page worth sending to your father.
            </p>
            <Link
              to="/login"
              className="mt-10 inline-flex items-center gap-2 rounded-full border border-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-accent transition hover:bg-accent hover:text-accent-foreground"
            >
              Tour the CMS
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── DEMO ────────────────────────────────────────────────────── */}
      <section id="demo" className="relative bg-card">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="font-sans text-xs uppercase tracking-[0.4em] text-accent-deep">
              Live preview
            </span>
            <h2 className="mt-4 font-display text-5xl font-medium leading-tight tracking-tight text-primary-deep">
              The kiosk, on the wall.
            </h2>
            <p className="mt-4 font-sans text-base leading-relaxed text-muted-foreground">
              A working preview of the clubhouse display. Choose a hole and
              watch the plates rotate, just as they would in the lounge.
            </p>
          </div>
          <div className="mt-14">
            <DemoKiosk />
          </div>
        </div>
      </section>

      {/* ─── FEATURES TRIO ───────────────────────────────────────────── */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="font-sans text-xs uppercase tracking-[0.4em] text-accent-deep">
              One platform
            </span>
            <h2 className="mt-4 font-display text-5xl font-medium leading-tight tracking-tight text-primary-deep">
              Run one course, or twenty.
            </h2>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <Feature
              icon={<MonitorPlay className="h-5 w-5" />}
              title="Kiosk display"
            >
              Fullscreen carousel for clubhouse TVs. Cached, auto-refreshing,
              quietly reliable.
            </Feature>
            <Feature
              icon={<Trophy className="h-5 w-5" />}
              title="Public record"
            >
              Branded, searchable, and permanent. The page a member is happy
              to share.
            </Feature>
            <Feature
              icon={<Settings className="h-5 w-5" />}
              title="Multi-course CMS"
            >
              Managers see only their course. SuperAdmins see everything.
              Roles, audits, and history out of the box.
            </Feature>
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden text-background"
        style={{ background: "var(--surface-dark)" }}
      >
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-20"
          style={{ background: "var(--gradient-brass)" }} />
        <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full opacity-15"
          style={{ background: "var(--gradient-brass)" }} />
        <div className="relative mx-auto max-w-4xl px-6 py-28 text-center">
          <h2 className="font-display text-5xl font-medium leading-tight tracking-tight md:text-6xl">
            Give your next ace<br />
            <em className="text-accent">the welcome it earned.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-sans text-base text-background/75">
            Set up takes an afternoon. The wall lasts forever.
          </p>
          <Link
            to="/login"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-sm font-semibold uppercase tracking-wider text-accent-foreground shadow-xl transition hover:bg-accent-deep"
          >
            Start your course
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-deep text-accent">
              <Flag className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-semibold text-primary-deep">
              Ace Board
            </span>
          </div>
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-muted-foreground">
            © {new Date().getFullYear()} · Made for the clubhouse
          </p>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative rounded-sm border border-border bg-card p-8 transition hover:border-accent">
      <div className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-deep text-accent">
        {icon}
      </div>
      <h3 className="font-display text-2xl font-semibold tracking-tight text-primary-deep">
        {title}
      </h3>
      <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

function FeatureRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}
