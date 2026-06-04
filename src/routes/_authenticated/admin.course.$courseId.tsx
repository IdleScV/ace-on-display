import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { derivePlanLabel, PLAN_LABEL_TEXT } from "@/lib/features";
import { supabase } from "@/integrations/supabase/client";
import { useCourseCtx } from "@/lib/course-context";
import { useAuth } from "@/lib/auth-context";
import { getCourseHealth } from "@/lib/health.functions";
import { CourseHeader, HoleSection } from "@/components/hole-section";
import type { PublicEntry, PublicHole } from "@/lib/public.functions";
import { ArrowLeft, ExternalLink, Monitor, Repeat, ListOrdered, Settings, ShieldAlert, Pencil, Trophy, Palette, MonitorPlay, Users, Sparkles } from "lucide-react";
import { TEMPLATES, STYLES, SKINS, resolveSkin, type DisplayTemplate, type BoardStyle } from "@/components/display-templates/types";
import { useState } from "react";
import { NameManager } from "@/components/name-manager";
import { PlateCustomizer } from "@/components/plate-customizer";
import { HoleMediaEditor } from "@/components/hole-media-editor";
import { IntakeShare } from "@/components/intake-share";
import { EmbedShare } from "@/components/embed-share";

export const Route = createFileRoute("/_authenticated/admin/course/$courseId")({
  component: CourseDashboard,
});

function CourseDashboard() {
  const { courseId } = Route.useParams();
  const { isSuperadmin } = useAuth();
  const { courses, loading } = useCourseCtx();
  const course = courses.find((c) => c.id === courseId) ?? null;

  const healthFn = useServerFn(getCourseHealth);
  const { data: health } = useQuery({
    queryKey: ["course-health", courseId],
    enabled: !!courseId,
    queryFn: () => healthFn({ data: { course_id: courseId } } as any),
    refetchInterval: 30_000,
  });

  const { data: holes = [] } = useQuery({
    queryKey: ["course-holes-full", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_holes")
        .select("id,hole_number,par,yardage")
        .eq("course_id", courseId)
        .order("hole_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["course-entries-summary", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id,hole_number,status,date_achieved,golfer_name")
        .eq("course_id", courseId);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!course) return <p className="text-sm text-muted-foreground">Course not found or access denied.</p>;

  const published = entries.filter((e: any) => e.status === "published");
  const drafts = entries.filter((e: any) => e.status !== "published");
  const countsByHole = new Map<number, number>();
  for (const e of published) countsByHole.set(e.hole_number, (countsByHole.get(e.hole_number) ?? 0) + 1);

  const aceableHoles = holes.length > 0 ? holes : [];
  const totalAces = published.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isSuperadmin && (
            <Link to="/admin/courses" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
              <ArrowLeft className="h-3.5 w-3.5" /> All courses
            </Link>
          )}
          {course.logo_url && (
            <img src={course.logo_url} alt="" className="h-10 w-10 rounded border bg-white object-contain" />
          )}
          <div>
            <h1 className="text-2xl font-semibold">{course.name}</h1>
            <p className="text-xs text-muted-foreground">/{course.slug}</p>
          </div>
        </div>
        <Link
          to="/admin/settings"
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <Pencil className="h-4 w-4" /> Edit setup
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total aces" value={totalAces} />
        <Stat label="Drafts" value={drafts.length} />
        <Stat label="Aceable holes" value={aceableHoles.length} />
        <Stat
          label="Display health"
          value={<HealthBadge s={(health?.status as any) ?? "never"} />}
          sub={health?.last_heartbeat_at ? `${Math.round(health.minutes_since ?? 0)}m ago` : "No heartbeat"}
        />
      </div>

      {/* Board links */}
      <Section title="Boards" desc="Open public-facing views in a new tab.">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <BoardLink href={`/${course.slug}/hole-in-ones`} icon={<ExternalLink className="h-4 w-4" />}
            title="Public board" desc="Main hall-of-fame view, grouped by hole." />
          <BoardLink href={`/${course.slug}/rotate?interval=10`} icon={<Repeat className="h-4 w-4" />}
            title="Rotating board" desc="Auto-cycles through every hole. ?interval= seconds, &all=1 includes empty holes." />
          <BoardLink href={`/${course.slug}/display`} icon={<Monitor className="h-4 w-4" />}
            title="Kiosk display" desc="Fullscreen kiosk view with heartbeat reporting." />
        </div>
        {aceableHoles.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ListOrdered className="h-3.5 w-3.5" /> Per-hole boards
            </div>
            <div className="flex flex-wrap gap-2">
              {aceableHoles.map((h: any) => (
                <a
                  key={h.id}
                  href={`/${course.slug}/hole/${h.hole_number}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <span className="font-medium">#{h.hole_number}</span>
                  <span className="text-xs text-muted-foreground">Par {h.par}{h.yardage ? ` · ${h.yardage}y` : ""}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {countsByHole.get(h.hole_number) ?? 0}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </Section>
      {/* Plan */}
      <Section
        title="Plan"
        desc="Toggle paid add-ons. The tier below is derived from these toggles."
      >
        <PlanEditor course={course} />
      </Section>

      {/* Public intake form */}
      <Section
        title="Intake form"
        desc="Share this link or QR code with golfers so they can submit their own holes-in-one."
      >
        <IntakeShare slug={course.slug} courseName={course.name} />
      </Section>

      {/* Embed on your website */}
      <Section
        title="Embed on your website"
        desc="Drop the board into any HTML page on your course's site."
      >
        <EmbedShare slug={course.slug} course={course} />
      </Section>



      {/* Display templates + styles */}
      <Section
        title="Display templates"
        desc="Pick a layout and a board style. Open in a new tab and bookmark on the clubhouse TV."
      >
        <TemplatesAndStyles course={course} />
      </Section>

      {/* Names on the board */}
      <Section
        title="Names on the board"
        desc="Edit golfer names inline and preview how they will appear, in any sort order."
        action={
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Published entries
          </span>
        }
      >
        <NameManager course={course} />
      </Section>

      {/* Customizable plates */}
      <Section
        title="Customize name plates"
        desc="Add a tagline, badge, accent color, or highlight to any plate. Preview updates live."
        action={
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Per-entry styling
          </span>
        }
      >
        <PlateCustomizer courseId={course.id} />
      </Section>

      {/* Per-hole media */}
      <Section
        title="Hole media"
        desc="Upload a top-down view image and a flyover/video for each aceable hole."
      >
        <HoleMediaEditor courseId={course.id} />
      </Section>




      {/* Aces per hole */}
      <Section title="Aces per hole" desc="Counts include published entries only.">
        {aceableHoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No holes defined yet. <Link to="/admin/settings" className="text-primary hover:underline">Add aceable holes</Link>.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Hole</th>
                  <th className="px-3 py-2">Par</th>
                  <th className="px-3 py-2">Yardage</th>
                  <th className="px-3 py-2 text-right">Aces</th>
                  <th className="px-3 py-2 text-right">Board</th>
                </tr>
              </thead>
              <tbody>
                {aceableHoles.map((h: any) => {
                  const count = countsByHole.get(h.hole_number) ?? 0;
                  return (
                    <tr key={h.id} className="border-t">
                      <td className="px-3 py-2 font-medium">#{h.hole_number}</td>
                      <td className="px-3 py-2">Par {h.par}</td>
                      <td className="px-3 py-2">{h.yardage ? `${h.yardage} yd` : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={count > 0 ? "font-semibold" : "text-muted-foreground"}>{count}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <a
                          href={`/${course.slug}/hole/${h.hole_number}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Open ↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Component style preview */}
      <Section
        title="Component style preview"
        desc="Live preview of how this course's branding renders on each public board component."
        action={
          <Link to="/admin/settings" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
            <Palette className="h-3.5 w-3.5" /> Edit styles
          </Link>
        }
      >
        <StylePreview course={course} sampleEntry={published[0]} sampleHole={aceableHoles[0]} />
      </Section>

      {/* Setup summary */}
      <Section title="Setup" desc="Branding and display configuration." action={
        <Link to="/admin/settings" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
          <Settings className="h-3.5 w-3.5" /> Open settings
        </Link>
      }>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <SetupRow label="Primary color">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded border" style={{ background: course.primary_color }} />
              <code className="text-xs">{course.primary_color}</code>
            </span>
          </SetupRow>
          <SetupRow label="Secondary color">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded border" style={{ background: course.secondary_color }} />
              <code className="text-xs">{course.secondary_color}</code>
            </span>
          </SetupRow>
          <SetupRow label="Public page">{course.public_enabled ? "Enabled" : "Disabled"}</SetupRow>
          <SetupRow label="Display sort">{course.display_sort}</SetupRow>
        </dl>
      </Section>

      {/* Health */}
      <Section title="Display health" desc="Heartbeats refresh every 30 seconds.">
        {!health ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <SetupRow label="Status"><HealthBadge s={health.status} /></SetupRow>
            <SetupRow label="Last heartbeat">
              {health.last_heartbeat_at
                ? `${new Date(health.last_heartbeat_at).toLocaleString()} (${Math.round(health.minutes_since ?? 0)}m ago)`
                : "Never"}
            </SetupRow>
            <SetupRow label="Data version">
              {(health.data_version_seen ?? "—")} / {health.data_version_current}
              {health.data_version_seen != null && health.data_version_seen < health.data_version_current && (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-3 w-3" /> stale
                </span>
              )}
            </SetupRow>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, desc, action, children }: { title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SetupRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function BoardLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group rounded-xl border bg-background p-4 hover:bg-accent"
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <span className="text-muted-foreground group-hover:text-foreground">{icon}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
      <div className="mt-2 truncate text-xs text-primary">{href}</div>
    </a>
  );
}

function HealthBadge({ s }: { s: "online" | "stale" | "offline" | "never" }) {
  const map: Record<string, string> = {
    online: "bg-green-500/15 text-green-700 dark:text-green-400",
    stale: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    offline: "bg-destructive/15 text-destructive",
    never: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-block rounded-md px-2 py-0.5 text-sm font-medium ${map[s]}`}>{s}</span>;
}

function StylePreview({
  course,
  sampleEntry,
  sampleHole,
}: {
  course: { id: string; name: string; slug: string; logo_url: string | null; primary_color: string; secondary_color: string };
  sampleEntry?: { id: string; golfer_name: string; date_achieved: string; hole_number: number } | undefined;
  sampleHole?: { hole_number: number; par: number; yardage: number | null } | undefined;
}) {
  const hole: PublicHole = sampleHole
    ? { hole_number: sampleHole.hole_number, par: sampleHole.par, yardage: sampleHole.yardage }
    : { hole_number: 7, par: 3, yardage: 165 };
  const sampleAces: PublicEntry[] = [
    {
      id: "preview-1",
      golfer_name: sampleEntry?.golfer_name ?? "Sample Golfer",
      date_achieved: sampleEntry?.date_achieved ?? new Date().toISOString().slice(0, 10),
      hole_number: hole.hole_number,
      yardage: hole.yardage,
      club: "7 Iron",
      witness: "Jane Doe",
      notes: null,
      photo_url: null,
    },
    {
      id: "preview-2",
      golfer_name: "Alex Rivera",
      date_achieved: "2024-06-12",
      hole_number: hole.hole_number,
      yardage: hole.yardage,
      club: "Pitching Wedge",
      witness: null,
      notes: null,
      photo_url: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tokens */}
      <div className="grid gap-3 sm:grid-cols-3">
        <TokenSwatch label="Primary" value={course.primary_color} />
        <TokenSwatch label="Secondary" value={course.secondary_color} />
        <div className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Logo</div>
          <div className="ml-auto">
            {course.logo_url ? (
              <img src={course.logo_url} alt="" className="h-8 w-8 rounded border bg-white object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>
        </div>
      </div>

      {/* CourseHeader */}
      <PreviewBlock label="CourseHeader" desc="Used at the top of all public boards.">
        <div className="overflow-hidden rounded-lg border bg-neutral-950">
          <CourseHeader course={course} subtitle="Hole-in-One Club · 12 aces" />
        </div>
      </PreviewBlock>

      {/* HoleSection + NamePlate */}
      <PreviewBlock label="HoleSection / NamePlate" desc="Per-hole grouping shown on the main and per-hole boards.">
        <div className="overflow-hidden rounded-lg border bg-neutral-950 p-4">
          <HoleSection hole={hole} aces={sampleAces} />
        </div>
      </PreviewBlock>

      {/* Kiosk hero */}
      <PreviewBlock label="Kiosk display hero" desc="Fullscreen kiosk uses primary color for the background gradient.">
        <div
          className="flex h-56 items-center justify-center rounded-lg border text-white"
          style={{
            background: `linear-gradient(135deg, ${course.primary_color} 0%, ${shadeHex(course.primary_color, -20)} 100%)`,
          }}
        >
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              {course.logo_url ? (
                <img src={course.logo_url} alt="" className="h-10 w-10 rounded bg-white object-contain p-1" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-white/15">
                  <Trophy className="h-5 w-5" />
                </div>
              )}
              <div className="text-left">
                <div className="text-lg font-bold leading-tight">{course.name}</div>
                <div className="text-[11px] uppercase tracking-widest opacity-80">Hole-in-One Honor Roll</div>
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight">{sampleAces[0].golfer_name}</div>
            <div className="mt-1 text-xs uppercase tracking-widest opacity-80">
              Hole #{hole.hole_number} · {hole.yardage ?? "—"} yd
            </div>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function TokenSwatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
      <span className="inline-block h-6 w-6 rounded border" style={{ background: value }} />
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <code className="ml-auto text-xs">{value}</code>
    </div>
  );
}

function PreviewBlock({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function shadeHex(hex: string, percent: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  let r = (num >> 16) + Math.round((percent / 100) * 255);
  let g = ((num >> 8) & 0x00ff) + Math.round((percent / 100) * 255);
  let b = (num & 0x0000ff) + Math.round((percent / 100) * 255);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function TemplatesAndStyles({
  course,
}: {
  course: { slug: string; name: string; logo_url: string | null; primary_color: string; secondary_color: string };
}) {
  const [style, setStyle] = useState<BoardStyle>("walnut");
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Board style</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {STYLES.map((s) => {
            const active = s.id === style;
            return (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className="flex items-start gap-3 rounded-lg border p-3 text-left transition hover:bg-accent"
                style={{ borderColor: active ? s.accent : undefined, boxShadow: active ? `0 0 0 1px ${s.accent}` : undefined }}
              >
                <div
                  className="h-10 w-10 shrink-0 rounded-md"
                  style={{ background: s.background, boxShadow: `inset 0 0 0 2px ${s.rim}, inset 0 0 0 3px ${s.accent}` }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[11px] leading-snug text-muted-foreground">{s.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.id} courseSlug={course.slug} tpl={t} course={course} style={style} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  courseSlug,
  tpl,
  course,
  style,
}: {
  courseSlug: string;
  tpl: { id: DisplayTemplate; label: string; desc: string; longMonitor?: boolean };
  course: { name: string; logo_url: string | null; primary_color: string; secondary_color: string };
  style: BoardStyle;
}) {
  const href = `/${courseSlug}/display?template=${tpl.id}&style=${style}`;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-background">
      <div className="relative aspect-[16/9] overflow-hidden border-b bg-neutral-950">
        <TemplateThumb id={tpl.id} course={course} style={style} />
        {tpl.longMonitor && (
          <span className="absolute right-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-900">
            Long monitor
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{tpl.label}</div>
          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">?template={tpl.id}&amp;style={style}</code>
        </div>
        <p className="flex-1 text-xs text-muted-foreground">{tpl.desc}</p>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center justify-center gap-1 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <MonitorPlay className="h-3.5 w-3.5" /> Open template
        </a>
      </div>
    </div>
  );
}

function TemplateThumb({
  id,
  course,
  style,
}: {
  id: DisplayTemplate;
  course: { name: string; logo_url: string | null; primary_color: string; secondary_color: string };
  style: BoardStyle;
}) {
  const skin = resolveSkin(style, { coursePrimary: course.primary_color });
  if (id === "spotlight") {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center text-white"
        style={{ background: `linear-gradient(135deg, ${course.primary_color} 0%, ${shadeHex(course.primary_color, -20)} 100%)` }}
      >
        <div className="text-[8px] uppercase tracking-widest opacity-70">Hole-in-One</div>
        <div className="mt-1 text-lg font-extrabold leading-none">Sample Golfer</div>
        <div className="mt-1.5 flex gap-1">
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[8px]">#7</span>
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[8px]">165 yd</span>
        </div>
        <div className="mt-1.5 text-[7px] uppercase tracking-widest opacity-50">(Spotlight ignores board style)</div>
      </div>
    );
  }
  if (id === "plaque") {
    return (
      <div className="flex h-full w-full flex-col p-1.5" style={{ background: skin.background }}>
        <div className="mx-auto mb-1.5 rounded px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest"
          style={{ background: skin.plateBg, color: skin.accent, boxShadow: `inset 0 0 0 1px ${skin.accent}` }}>
          Hole #7 · 3 aces
        </div>
        <div className="grid flex-1 grid-cols-3 gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-sm"
              style={{ background: skin.plateBg, boxShadow: `inset 0 0 0 1px ${skin.accent}${i === 1 ? "" : "88"}` }} />
          ))}
        </div>
      </div>
    );
  }
  // ultrawide
  return (
    <div className="grid h-full w-full grid-cols-[1.2fr_2fr_0.7fr] gap-0.5 bg-black">
      <div
        className="flex flex-col items-center justify-center p-1 text-white"
        style={{ background: `linear-gradient(160deg, ${course.primary_color} 0%, ${shadeHex(course.primary_color, -30)} 100%)` }}
      >
        <div className="text-[7px] uppercase tracking-widest opacity-70">Featured</div>
        <div className="text-[10px] font-extrabold leading-none">Sample</div>
      </div>
      <div className="grid grid-cols-3 gap-0.5 p-1" style={{ background: skin.background }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-[1px]"
            style={{ background: skin.plateBg, boxShadow: `inset 0 0 0 1px ${skin.accent}88` }} />
        ))}
      </div>
      <div className="flex flex-col gap-0.5 bg-neutral-950 p-1">
        {[7, 12, 16].map((n) => (
          <div key={n} className="flex items-center justify-between rounded-sm border px-1 py-0.5 text-[7px]"
            style={{ borderColor: "#222", color: skin.accent }}>
            <span>#{n}</span><span>·</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanEditor({ course }: { course: any }) {
  const qc = useQueryClient();
  const [hasTouch, setHasTouch] = useState<boolean>(!!course.has_touch);
  const [isMulti, setIsMulti] = useState<boolean>(!!course.is_multi_board);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const plan = derivePlanLabel({ has_touch: hasTouch, is_multi_board: isMulti });

  async function update(next: { has_touch: boolean; is_multi_board: boolean }) {
    setSaving(true);
    setErr(null);
    const planLabel = derivePlanLabel(next);
    const { error } = await supabase
      .from("courses")
      .update({ ...next, plan_label: planLabel })
      .eq("id", course.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-courses"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle
          label="Touch screen"
          desc="Interactive kiosk: tap holes, browse stories, view media."
          checked={hasTouch}
          disabled={saving}
          onChange={(v) => {
            setHasTouch(v);
            update({ has_touch: v, is_multi_board: isMulti });
          }}
        />
        <Toggle
          label="Multi-board"
          desc="Multiple synced displays across the clubhouse / estate."
          checked={isMulti}
          disabled={saving}
          onChange={(v) => {
            setIsMulti(v);
            update({ has_touch: hasTouch, is_multi_board: v });
          }}
        />
      </div>
      <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Current tier</span>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">
          {PLAN_LABEL_TEXT[plan]}
        </span>
        {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 ${disabled ? "opacity-60" : "hover:bg-accent/40"}`}>
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </label>
  );
}
