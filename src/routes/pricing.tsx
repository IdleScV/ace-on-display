import { createFileRoute, Link } from "@tanstack/react-router";
import { Flag, Check, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — Ace Board by Enshrined" },
      {
        name: "description",
        content:
          "Choose the right Ace Board for your clubhouse — touch or non-touch, single board or multi-board across your properties.",
      },
      { property: "og:title", content: "Pricing — Ace Board by Enshrined" },
      {
        property: "og:description",
        content:
          "Touch and non-touch clubhouse displays, priced for single courses and multi-course operators.",
      },
    ],
  }),
});

type Tier = {
  name: string;
  tagline: string;
  setup: string;
  perBoard: string;
  highlight?: boolean;
  features: string[];
};

const singleBoardTiers: Tier[] = [
  {
    name: "Classic",
    tagline: "Non-touch display",
    setup: "$1,999 one-time setup",
    perBoard: "$299 per board",
    features: [
      "One clubhouse display",
      "Walnut, mahogany, slate, or modern-dark plaque skins",
      "Per-course colors, logo, and typography",
      "Public hole-in-one record page",
      "Manager CMS access",
      "Email support",
    ],
  },
  {
    name: "Interactive",
    tagline: "Touch screen display",
    setup: "$2,999 one-time setup",
    perBoard: "$449 per board",
    highlight: true,
    features: [
      "Everything in Classic",
      "Touch-to-browse aces by name, hole, and year",
      "Per-hole flyovers and photo galleries on demand",
      "Member self-serve search",
      "Priority email & phone support",
    ],
  },
];

const multiBoardTiers: Tier[] = [
  {
    name: "Estate",
    tagline: "Multi-board, non-touch",
    setup: "Custom install quote",
    perBoard: "$249 per board",
    features: [
      "Up to 5 displays across one or more properties",
      "Centralized CMS for all courses",
      "Per-course branding and rosters",
      "Roll-up reporting across properties",
      "Dedicated onboarding",
    ],
  },
  {
    name: "Estate Interactive",
    tagline: "Multi-board, touch screen",
    setup: "Custom install quote",
    perBoard: "$349 per board",
    highlight: true,
    features: [
      "Everything in Estate",
      "Touch interactivity on every board",
      "Cross-property leaderboard mode",
      "SSO and role-based access",
      "Named account manager",
    ],
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <nav className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5 text-primary-deep">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-deep text-accent">
              <Flag className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="font-display text-2xl font-semibold tracking-tight">
              Enshrined
            </span>
            <span className="ml-2 hidden font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground sm:inline">
              · Ace Board
            </span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/pricing" className="font-medium text-foreground">Pricing</Link>
          </div>
          <Link
            to="/login"
            className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Member sign in
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <span className="font-sans text-xs uppercase tracking-[0.4em] text-accent-deep">
            Pricing
          </span>
          <h1 className="mt-6 font-display text-5xl font-medium leading-tight tracking-tight text-primary-deep md:text-6xl">
            One board, or a whole estate.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-base leading-relaxed text-muted-foreground">
            Ace Board by Enshrined comes in two flavors — a classic
            non-touch display, and an interactive touch screen edition —
            with single-course and multi-course plans for each.
          </p>
        </div>
      </section>

      {/* SINGLE BOARD */}
      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-12 text-center">
            <span className="font-sans text-xs uppercase tracking-[0.4em] text-accent-deep">
              For a single course
            </span>
            <h2 className="mt-4 font-display text-4xl font-medium tracking-tight text-primary-deep">
              One board, one clubhouse.
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            {singleBoardTiers.map((t) => (
              <TierCard key={t.name} tier={t} />
            ))}
          </div>
        </div>
      </section>

      {/* MULTI BOARD */}
      <section
        className="border-y border-border text-background"
        style={{ background: "var(--surface-dark)" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-12 text-center">
            <span className="font-sans text-xs uppercase tracking-[0.4em] text-accent">
              For multi-course operators
            </span>
            <h2 className="mt-4 font-display text-4xl font-medium tracking-tight text-background">
              Multiple boards, one platform.
            </h2>
            <p className="mx-auto mt-4 max-w-xl font-sans text-sm text-background/70">
              Management groups, resorts, and clubs with sister properties.
              All boards, all rosters, one login.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            {multiBoardTiers.map((t) => (
              <TierCard key={t.name} tier={t} dark />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ-ish strip */}
      <section className="bg-background">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h3 className="font-display text-3xl font-medium tracking-tight text-primary-deep">
            Need something custom?
          </h3>
          <p className="mx-auto mt-4 max-w-xl font-sans text-sm text-muted-foreground">
            Larger estates, video-wall installs, custom plaque finishes, or
            an on-prem deployment — we'll build a quote that fits.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-accent-foreground shadow-lg hover:bg-accent-deep"
          >
            Talk to Enshrined
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-deep text-accent">
              <Flag className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-semibold text-primary-deep">
              Enshrined
            </span>
            <span className="font-sans text-xs uppercase tracking-[0.3em] text-muted-foreground">
              · Ace Board
            </span>
          </div>
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-muted-foreground">
            © {new Date().getFullYear()} Enshrined · Made for the clubhouse
          </p>
        </div>
      </footer>
    </div>
  );
}

function TierCard({ tier, dark = false }: { tier: Tier; dark?: boolean }) {
  const base = dark
    ? "border-background/15 bg-background/5 text-background"
    : "border-border bg-card text-foreground";
  const highlight = tier.highlight
    ? dark
      ? "ring-2 ring-accent"
      : "ring-2 ring-accent"
    : "";
  return (
    <div
      className={`relative rounded-sm border p-8 ${base} ${highlight}`}
      style={tier.highlight ? { boxShadow: "var(--shadow-elegant)" } : undefined}
    >
      {tier.highlight && (
        <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-foreground">
          Most popular
        </span>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className={`font-display text-2xl font-semibold tracking-tight ${dark ? "text-background" : "text-primary-deep"}`}>
          {tier.name}
        </h3>
        <span className={`font-sans text-xs uppercase tracking-[0.25em] ${dark ? "text-accent" : "text-accent-deep"}`}>
          {tier.tagline}
        </span>
      </div>
      <div className="mt-6 flex items-baseline gap-1">
        <span className={`font-sans text-sm font-medium uppercase tracking-wider ${dark ? "text-background/70" : "text-muted-foreground"}`}>
          {tier.setup}
        </span>
      </div>
      <p className={`mt-2 font-display text-4xl font-medium ${dark ? "text-background" : "text-primary-deep"}`}>
        + {tier.perBoard}
      </p>
      <ul className="mt-8 space-y-3 font-sans text-sm">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-accent" : "text-accent-deep"}`} />
            <span className={dark ? "text-background/85" : "text-foreground/80"}>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/login"
        className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wider transition ${
          tier.highlight
            ? "bg-accent text-accent-foreground hover:bg-accent-deep"
            : dark
              ? "border border-background/30 text-background hover:bg-background/10"
              : "border border-border text-foreground hover:bg-muted"
        }`}
      >
        Get started
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
