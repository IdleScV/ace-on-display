import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { useAuth } from "@/lib/auth-context";
import { useCourseCtx } from "@/lib/course-context";
import { hasFeature, derivePlanLabel, PLAN_LABEL_TEXT } from "@/lib/features";
import { Link2, Lock, Search, BookOpen, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/how-to")({
  component: () => (
    <AdminShell>
      <HowToPage />
    </AdminShell>
  ),
  head: () => ({ meta: [{ title: "How-To — Ace Board" }] }),
});

type SectionDef = {
  id: string;
  title: string;
  audience: "all" | "manager" | "superadmin" | "reference";
  gated?: "embed_widget" | "email_export";
  body: ReactNode;
};

function HowToPage() {
  const { isSuperadmin } = useAuth();
  const { activeCourse } = useCourseCtx();

  const planFlags = {
    has_touch: !!activeCourse?.has_touch,
    is_multi_board: !!activeCourse?.is_multi_board,
  };

  const sections = useMemo<SectionDef[]>(() => allSections(), []);

  // Visibility by role
  const visible = sections.filter((s) => {
    if (s.audience === "superadmin") return isSuperadmin;
    return true; // managers + superadmins see everything else; gated sections still render (as locked card)
  });

  // TOC search
  const [query, setQuery] = useState("");
  const filtered = visible.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  // Active section tracking
  const [activeId, setActiveId] = useState<string>(visible[0]?.id ?? "");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const headings = visible
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (!headings.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top?.target.id) setActiveId(top.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 1] },
    );
    headings.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [visible]);

  // Smooth scroll for hash links + initial hash
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash.replace("#", "");
    if (h) {
      setTimeout(() => {
        document.getElementById(h)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      {/* TOC */}
      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="rounded-md border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-primary" /> Contents
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sections…"
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-xs outline-none focus:border-primary"
            />
          </div>
          <nav className="space-y-0.5 text-xs">
            {filtered.length === 0 && (
              <p className="text-muted-foreground">No matches.</p>
            )}
            {filtered.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  history.replaceState(null, "", `#${s.id}`);
                }}
                className={`block truncate rounded px-2 py-1 transition ${
                  activeId === s.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div ref={contentRef} className="min-w-0 space-y-12">
        <header className="border-b pb-6">
          <h1 className="font-display text-4xl font-medium tracking-tight text-primary-deep">
            How to use Ace Board
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm text-muted-foreground">
            A practical, no-nonsense guide for course managers and SuperAdmins.
          </p>
        </header>

        {visible.map((s) => (
          <Section key={s.id} def={s} planFlags={planFlags} />
        ))}
      </div>
    </div>
  );
}

function Section({
  def,
  planFlags,
}: {
  def: SectionDef;
  planFlags: { has_touch: boolean; is_multi_board: boolean };
}) {
  const copyLink = async () => {
    const url = `${window.location.origin}/how-to#${def.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const isGated = !!def.gated;
  const unlocked = !isGated || hasFeature(planFlags, def.gated!);

  return (
    <section id={def.id} className="scroll-mt-24">
      <div className="group mb-3 flex items-center gap-2">
        <h2 className="font-display text-2xl font-medium tracking-tight text-primary-deep">
          {def.title}
        </h2>
        <button
          onClick={copyLink}
          aria-label="Copy link to section"
          className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-accent/40 hover:text-foreground group-hover:opacity-100"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="prose prose-sm max-w-none font-sans text-sm leading-relaxed text-foreground/85 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-primary-deep [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1">
        {unlocked ? (
          def.body
        ) : (
          <LockedCard featureName={def.title} />
        )}
      </div>
    </section>
  );
}

function LockedCard({ featureName }: { featureName: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/30 p-4">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="text-sm">
        <div className="font-medium">{featureName} is locked on your plan</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Upgrade to <strong>Interactive</strong> or <strong>Estate Interactive</strong> to
          unlock this feature.
        </p>
        <Link
          to="/pricing"
          className="mt-2 inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          See plans
        </Link>
      </div>
    </div>
  );
}

/* ============================================================
 * Sections — content as JSX for full styling control
 * ============================================================ */

function allSections(): SectionDef[] {
  return [
    { id: "welcome", title: "Welcome to Ace Board", audience: "all", body: <Welcome /> },

    // Course Manager (visible to managers + superadmins)
    { id: "getting-started", title: "Getting started", audience: "manager", body: <GettingStarted /> },
    { id: "recording-an-ace", title: "Recording an ace", audience: "manager", body: <RecordingAnAce /> },
    { id: "intake-form", title: "The intake form", audience: "manager", body: <IntakeForm /> },
    { id: "reviewing-submissions", title: "Reviewing submissions", audience: "manager", body: <ReviewingSubmissions /> },
    { id: "witness-requirement", title: "Why we require a witness", audience: "manager", body: <WitnessRequirement /> },
    { id: "course-holes", title: "Setting up holes", audience: "manager", body: <CourseHoles /> },
    { id: "customizing-display", title: "Customizing the display", audience: "manager", body: <CustomizingDisplay /> },
    { id: "plate-customizer", title: "Plate customizer", audience: "manager", body: <PlateCustomizer /> },
    { id: "digital-trophy", title: "The digital trophy", audience: "manager", body: <DigitalTrophy /> },
    { id: "embed-on-website", title: "Embed on your website", audience: "manager", gated: "embed_widget", body: <EmbedOnWebsite /> },
    { id: "email-subscribers", title: "Email subscribers", audience: "manager", gated: "email_export", body: <EmailSubscribers /> },
    { id: "your-plan", title: "Your plan", audience: "manager", body: <YourPlan /> },

    // SuperAdmin only
    { id: "superadmin-onboarding", title: "SuperAdmin — onboarding a course", audience: "superadmin", body: <SaOnboarding /> },
    { id: "superadmin-managers", title: "SuperAdmin — managing managers", audience: "superadmin", body: <SaManagers /> },
    { id: "superadmin-plans", title: "SuperAdmin — plans & flags", audience: "superadmin", body: <SaPlans /> },
    { id: "superadmin-health", title: "SuperAdmin — display health", audience: "superadmin", body: <SaHealth /> },
    { id: "superadmin-audit", title: "SuperAdmin — audit log", audience: "superadmin", body: <SaAudit /> },

    // Reference (all)
    { id: "feature-matrix", title: "Feature matrix", audience: "reference", body: <FeatureMatrix /> },
    { id: "hardware-setup", title: "Hardware setup", audience: "reference", body: <HardwareSetup /> },
    { id: "troubleshooting", title: "Troubleshooting", audience: "reference", body: <Troubleshooting /> },
  ];
}

function Welcome() {
  return (
    <>
      <p>
        Ace Board is the digital hole-in-one record for your golf course. It shows past
        aces on a clubhouse display, lets golfers submit their own, and turns each
        ace into a shareable digital trophy.
      </p>
      <p>
        This guide walks through every part of it — from your first published entry to
        embedding the board on your website.
      </p>
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        If you're a course manager, scroll to <a className="underline" href="#getting-started">Getting started</a>.
        If you're a SuperAdmin, see the SuperAdmin sections toward the bottom.
      </p>
    </>
  );
}

function GettingStarted() {
  return (
    <>
      <h3>Your dashboard at a glance</h3>
      <p>
        The <strong>Entries</strong> tab is home base. It lists every ace at your course,
        published or draft, newest first. Pending submissions from the intake form show
        a small badge next to the tab — that's your review queue.
      </p>
      <p>
        If you manage more than one course, the dropdown in the header switches between
        them. The whole CMS (entries, settings, subscribers) follows your selection.
      </p>
      <p>
        <strong>Settings</strong> is where you set course colors, the public-board toggle,
        per-hole information, and the display sort order.
      </p>
    </>
  );
}

function RecordingAnAce() {
  return (
    <>
      <p>Step by step:</p>
      <ul>
        <li>Open <strong>Entries</strong> → click <strong>New entry</strong>.</li>
        <li>Fill in the required fields: golfer name, date, hole number, and witness.</li>
        <li>Optional but recommended: club, yardage, photo, video, notes.</li>
        <li>Save as <strong>Draft</strong> to come back to it, or <strong>Publish</strong> when ready.</li>
      </ul>
      <p>
        Drafts don't appear on the clubhouse display, the public board, or the trophy
        page. Nothing is visible to golfers until you publish it.
      </p>
    </>
  );
}

function IntakeForm() {
  return (
    <>
      <h3>Let golfers tell their own story</h3>
      <p>
        The intake form lives at <code>/&#123;your-course&#125;/submit</code>. Share it
        with golfers however suits you:
      </p>
      <ul>
        <li>Printed card at the proshop counter</li>
        <li>Link in your post-round email</li>
        <li>QR code framed on the clubhouse wall next to the display</li>
      </ul>
      <p>
        Submissions land as drafts in your review queue. They never auto-publish — a
        manager always confirms.
      </p>
    </>
  );
}

function ReviewingSubmissions() {
  return (
    <>
      <p>
        Pending submissions show in <strong>Entries</strong> with a "Pending" pill and
        the badge on the nav tab.
      </p>
      <p>Before publishing, check:</p>
      <ul>
        <li>Spelling of the golfer's and witness's names</li>
        <li>Date and hole number look right</li>
        <li>Photo orientation and that it actually shows the moment</li>
        <li>Video length is reasonable (under a minute or so plays best on the board)</li>
      </ul>
      <p>
        Use <strong>Edit</strong> to correct anything, <strong>Publish</strong> when it's
        clean, or <strong>Archive</strong> to hide a submission without deleting it.
      </p>
    </>
  );
}

function WitnessRequirement() {
  return (
    <>
      <p>
        Every published ace requires a named witness. This is a hard rule across the
        platform — there's no "save without witness" override.
      </p>
      <p>
        It protects the integrity of the board. Chris (our co-founder) is firm on this:
        the small bit of friction is worth keeping the record honest.
      </p>
      <p>
        The witness can be a playing partner, a marshal, the bartender — anyone present
        at the time. Just a name; we don't need contact details.
      </p>
    </>
  );
}

function CourseHoles() {
  return (
    <>
      <p>
        In <strong>Settings → Holes</strong>, set each hole's <strong>par</strong> and
        <strong> yardage</strong>. These appear next to entries on the public board and
        trophy pages.
      </p>
      <p>
        You can also upload a <strong>topdown image</strong> and an optional{" "}
        <strong>flyover video</strong> per hole. Both show on the digital trophy page
        for any ace on that hole — so the story isn't just the moment, it's the hole.
      </p>
    </>
  );
}

function CustomizingDisplay() {
  return (
    <>
      <h3>Three templates</h3>
      <ul>
        <li><strong>Spotlight</strong> — rotating fullscreen, one ace at a time. Great for a TV above the bar.</li>
        <li><strong>Plaque</strong> — a clubhouse plaque wall. Portrait monitors look stunning with this.</li>
        <li><strong>Ultrawide</strong> — long horizontal ribbon for an ultra-wide monitor.</li>
      </ul>
      <h3>Four skins</h3>
      <ul>
        <li><strong>Walnut &amp; brass</strong> — warm, traditional clubhouse</li>
        <li><strong>Mahogany &amp; gold</strong> — deep, formal, prestige</li>
        <li><strong>Slate &amp; silver</strong> — modern, understated</li>
        <li><strong>Modern dark</strong> — minimal, contemporary</li>
      </ul>
      <p>
        Preview any combination from Settings before saving. The skin you pick is used
        everywhere golfers see the course — the display, the public board, and trophy pages.
      </p>
    </>
  );
}

function PlateCustomizer() {
  return (
    <>
      <h3>Highlight a special ace</h3>
      <p>
        On any individual entry you can add a custom badge, tagline, accent color, or
        "highlight" flag. Use it for tournament-winning aces, course records, or
        commemorative entries — they'll stand out visually on the board and trophy page.
      </p>
    </>
  );
}

function DigitalTrophy() {
  return (
    <>
      <p>
        Every published entry gets its own page at{" "}
        <code>/&#123;course&#125;/entry/&#123;id&#125;</code>. Think of it as the digital
        equivalent of having your name on a brass plate — but shareable.
      </p>
      <p>
        Each page has full OpenGraph tags, so when a golfer drops the link into iMessage,
        Facebook, or Twitter, the preview looks polished automatically.
      </p>
      <p>
        Golfers can share from the page itself with the share button, or you can paste
        the link into a follow-up email after publishing.
      </p>
    </>
  );
}

function EmbedOnWebsite() {
  return (
    <>
      <h3>Show your board on your course's website</h3>
      <p>
        In <strong>Settings</strong>, scroll to the <strong>Embed</strong> section.
        Copy the iframe snippet and paste it into any HTML block on your course's site —
        Squarespace, WordPress, Wix, Webflow, anything that takes raw HTML.
      </p>
      <p>
        The embed is fully responsive: whatever width you give the iframe, it adapts.
        Try <code>width="100%"</code> and a fixed height of 600px to start.
      </p>
    </>
  );
}

function EmailSubscribers() {
  return (
    <>
      <h3>Build your hole-in-one mailing list</h3>
      <p>
        When a golfer ticks "keep me posted" on the intake form, their email lands in{" "}
        <strong>Subscribers</strong>. You can also add subscribers manually.
      </p>
      <p>
        Export the list to CSV for use with Mailchimp, Constant Contact, or your own
        newsletter tool. Unsubscribe links are automatic and respected — once a golfer
        opts out, they're permanently flagged and won't be re-emailed.
      </p>
    </>
  );
}

function YourPlan() {
  const { activeCourse } = useCourseCtx();
  if (!activeCourse) {
    return <p className="text-muted-foreground">Select a course to see its plan.</p>;
  }
  const label = derivePlanLabel({
    has_touch: !!activeCourse.has_touch,
    is_multi_board: !!activeCourse.is_multi_board,
  });
  return (
    <>
      <div className="rounded-md border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Current plan
        </div>
        <div className="mt-1 font-display text-2xl font-medium text-primary-deep">
          {PLAN_LABEL_TEXT[label]}
        </div>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <PlanFlag on={!!activeCourse.has_touch} label="Touch interactivity" />
          <PlanFlag on={!!activeCourse.has_touch} label="Video upload" />
          <PlanFlag on={!!activeCourse.has_touch} label="Website embed" />
          <PlanFlag on={!!activeCourse.is_multi_board} label="Multi-board / multi-course" />
          <PlanFlag on={!!activeCourse.has_touch || !!activeCourse.is_multi_board} label="Email subscribers" />
        </div>
      </div>
      <p className="mt-4">
        <Link to="/pricing" className="underline">See all plans →</Link>
      </p>
      <p className="text-xs text-muted-foreground">
        Plan changes are currently handled manually — contact us to upgrade.
      </p>
    </>
  );
}

function PlanFlag({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background px-2 py-1.5">
      {on ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className={on ? "text-foreground" : "text-muted-foreground line-through"}>{label}</span>
    </div>
  );
}

function SaOnboarding() {
  return (
    <>
      <p>To stand up a new course:</p>
      <ul>
        <li>Go to <strong>Courses → New course</strong>.</li>
        <li>Set the name, URL slug, logo, and primary/secondary colors.</li>
        <li>Pick the initial plan via the <code>has_touch</code> and <code>is_multi_board</code> flags.</li>
        <li>Save, then assign at least one course manager (next section).</li>
      </ul>
    </>
  );
}

function SaManagers() {
  return (
    <>
      <p>
        From <strong>Courses → [course] → Managers</strong>, invite a user by email. They'll
        receive a sign-in link. Once they're in, they have full CMS access to that course
        only.
      </p>
      <p>
        Revoke access from the same panel — removal is immediate and they lose CMS access
        on their next request.
      </p>
    </>
  );
}

function SaPlans() {
  return (
    <>
      <h3>Two axes, four tiers</h3>
      <p>
        Plans are derived from two boolean flags on each course:
      </p>
      <ul>
        <li><code>has_touch</code> — unlocks touch interactivity, video upload, and the website embed</li>
        <li><code>is_multi_board</code> — unlocks multi-board / multi-course management</li>
      </ul>
      <p>That gives four tiers:</p>
      <ul>
        <li><strong>Classic</strong> — both off</li>
        <li><strong>Interactive</strong> — touch on, multi off</li>
        <li><strong>Estate</strong> — touch off, multi on</li>
        <li><strong>Estate Interactive</strong> — both on</li>
      </ul>
      <p>
        Toggling a flag instantly changes what the manager sees in their CMS — gated
        features unlock or lock without a re-login. Every change writes to{" "}
        <code>audit_logs</code>.
      </p>
    </>
  );
}

function SaHealth() {
  return (
    <>
      <p>
        The <strong>Display health</strong> dashboard shows every clubhouse display
        across every course and its last heartbeat.
      </p>
      <ul>
        <li><strong>Online</strong> — heartbeat in the last 90 seconds</li>
        <li><strong>Stale</strong> — last heartbeat 90s–5 minutes ago</li>
        <li><strong>Offline</strong> — no heartbeat for over 5 minutes</li>
      </ul>
      <p>
        Email alerts fire when a display drops to offline so you can get ahead of the
        call from the proshop.
      </p>
    </>
  );
}

function SaAudit() {
  return (
    <>
      <p>
        The <strong>Audit</strong> view logs every meaningful change: entry publishes,
        plan flag toggles, manager assignments, course settings updates.
      </p>
      <p>
        Filter by course, by user, or by action. Use it to answer "who changed this and
        when?" — exports as CSV for record-keeping.
      </p>
    </>
  );
}

function FeatureMatrix() {
  const rows: { feature: string; classic: boolean; interactive: boolean; estate: boolean; estateInt: boolean }[] = [
    { feature: "Public board & manager CMS", classic: true, interactive: true, estate: true, estateInt: true },
    { feature: "Custom skin & colors", classic: true, interactive: true, estate: true, estateInt: true },
    { feature: "Intake form", classic: true, interactive: true, estate: true, estateInt: true },
    { feature: "Digital trophy pages", classic: true, interactive: true, estate: true, estateInt: true },
    { feature: "Touch interactivity", classic: false, interactive: true, estate: false, estateInt: true },
    { feature: "Video upload on entries", classic: false, interactive: true, estate: false, estateInt: true },
    { feature: "Website embed widget", classic: false, interactive: true, estate: false, estateInt: true },
    { feature: "Email subscriber capture & export", classic: false, interactive: true, estate: true, estateInt: true },
    { feature: "Multi-board / multi-course", classic: false, interactive: false, estate: true, estateInt: true },
    { feature: "Cross-property leaderboard", classic: false, interactive: false, estate: false, estateInt: true },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/30 text-left">
            <th className="px-3 py-2 font-semibold">Feature</th>
            <th className="px-3 py-2 font-semibold">Classic</th>
            <th className="px-3 py-2 font-semibold">Interactive</th>
            <th className="px-3 py-2 font-semibold">Estate</th>
            <th className="px-3 py-2 font-semibold">Estate Int.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.feature} className="border-b">
              <td className="px-3 py-2">{r.feature}</td>
              <td className="px-3 py-2">{r.classic ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-3 py-2">{r.interactive ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-3 py-2">{r.estate ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-3 py-2">{r.estateInt ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="text-muted-foreground">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HardwareSetup() {
  return (
    <>
      <p>
        Most clubhouses run Ace Board on a small Raspberry Pi 4 or mini-PC in
        Chromium kiosk mode, wired to an HDMI display.
      </p>
      <ul>
        <li>A 1080p or 4K display — portrait orientation pairs beautifully with the Plaque template</li>
        <li>Wired ethernet preferred over Wi-Fi for reliability</li>
        <li>Chromium launched in <code>--kiosk</code> mode pointing at <code>/&#123;slug&#125;/display</code></li>
      </ul>
      <p className="text-xs text-muted-foreground">
        A detailed hardware guide is coming soon — in the meantime, contact us for the
        recommended Pi image and kiosk config.
      </p>
    </>
  );
}

function Troubleshooting() {
  const items: { q: string; a: ReactNode }[] = [
    { q: "Display isn't updating", a: <>Check network connectivity at the clubhouse, and confirm the entry is <strong>Published</strong> not Draft.</> },
    { q: "Photo won't upload", a: <>Check the file size — limits are 10 MB for photos and 50 MB for videos.</> },
    { q: "I forgot my password", a: <>Use the password reset link on <Link to="/login" className="underline">the login page</Link>.</> },
    { q: "I can't see a feature I expected", a: <>Check your course's plan in <a href="#your-plan" className="underline">Your plan</a> — some features are gated to Interactive / Estate tiers.</> },
  ];
  return (
    <ul>
      {items.map((i) => (
        <li key={i.q}>
          <strong>{i.q}</strong> — {i.a}
        </li>
      ))}
    </ul>
  );
}
