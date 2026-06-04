import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasFeature } from "@/lib/features";
import { toast } from "sonner";
import { Trophy, Upload, X, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/$slug/submit")({
  component: SubmitPage,
  head: ({ params }) => ({
    meta: [
      { title: `Submit a hole-in-one — ${params.slug}` },
      { name: "description", content: "Tell us about your ace. We'll get it onto the board." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

interface CoursePublic {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  has_touch: boolean;
}

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SECONDS = 60;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

function SubmitPage() {
  const { slug } = Route.useParams();
  const [course, setCourse] = useState<CoursePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,name,slug,logo_url,primary_color,has_touch,public_enabled")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data || !data.public_enabled) {
        setCourse(null);
      } else {
        setCourse(data as any);
      }
      setLoading(false);
    })();
  }, [slug]);

  const accent = course?.primary_color ?? "#0f5132";
  const themeStyle = useMemo(
    () => ({ ["--brand" as any]: accent } as React.CSSProperties),
    [accent],
  );

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Course not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This intake link is no longer active.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={themeStyle} className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          {course.logo_url ? (
            <img src={course.logo_url} alt={course.name} className="h-10 w-10 rounded object-contain" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded text-white"
              style={{ backgroundColor: accent }}
            >
              <Trophy className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Submit your ace</div>
            <div className="font-semibold leading-tight">{course.name}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6 pb-32">
        {submitted ? (
          <ThankYou course={course} onAnother={() => setSubmitted(false)} />
        ) : (
          <IntakeForm course={course} onDone={() => setSubmitted(true)} />
        )}
      </main>
    </div>
  );
}

function ThankYou({ course, onAnother }: { course: CoursePublic; onAnother: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: `${course.primary_color}22`, color: course.primary_color }}
      >
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-2xl font-semibold">Thanks — we got it.</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your hole-in-one has been submitted to <span className="font-medium text-foreground">{course.name}</span> for
        review. You'll see it on the board soon — and we'll let you know when it's live.
      </p>
      <button
        onClick={onAnother}
        className="mt-6 rounded-md border px-4 py-2 text-sm hover:bg-accent"
      >
        Submit another ace
      </button>
    </div>
  );
}

function IntakeForm({ course, onDone }: { course: CoursePublic; onDone: () => void }) {
  const showVideo = hasFeature({ has_touch: course.has_touch, is_multi_board: false }, "video_upload");
  const today = new Date().toISOString().slice(0, 10);

  const [golferName, setGolferName] = useState("");
  const [dateAchieved, setDateAchieved] = useState(today);
  const [holeNumber, setHoleNumber] = useState(1);
  const [witness, setWitness] = useState("");
  const [yardage, setYardage] = useState("");
  const [club, setClub] = useState("");
  const [story, setStory] = useState("");
  const [handicap, setHandicap] = useState("");
  const [favHole, setFavHole] = useState("");
  const [yearsPlaying, setYearsPlaying] = useState("");
  const [priorAces, setPriorAces] = useState("");
  const [email, setEmail] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  const onPhotosSelected = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { toast.error(`Max ${MAX_PHOTOS} photos`); return; }
    const accepted: File[] = [];
    for (const f of incoming.slice(0, room)) {
      if (!PHOTO_TYPES.includes(f.type) && !f.type.startsWith("image/")) {
        toast.error(`${f.name}: unsupported image type`); continue;
      }
      if (f.size > MAX_PHOTO_BYTES) { toast.error(`${f.name}: max 8MB`); continue; }
      accepted.push(f);
    }
    if (accepted.length) setPhotos((p) => [...p, ...accepted]);
  };

  const onVideoSelected = async (file: File | null) => {
    if (!file) { setVideo(null); return; }
    if (!VIDEO_TYPES.includes(file.type) && !file.type.startsWith("video/")) {
      toast.error("Unsupported video type"); return;
    }
    if (file.size > MAX_VIDEO_BYTES) { toast.error("Video must be ≤ 50MB"); return; }
    // Duration check (best-effort)
    try {
      const duration = await readVideoDuration(file);
      if (duration > MAX_VIDEO_SECONDS + 0.5) {
        toast.error(`Video must be ≤ ${MAX_VIDEO_SECONDS}s (yours is ${Math.round(duration)}s)`);
        return;
      }
    } catch {
      // ignore duration probe failure
    }
    setVideo(file);
  };

  const removePhoto = (idx: number) => setPhotos((p) => p.filter((_, i) => i !== idx));

  const uploadOne = async (file: File, label: "photo" | "video") => {
    const ext = file.name.split(".").pop() || (label === "video" ? "mp4" : "jpg");
    const safe = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext.toLowerCase()}`;
    const path = `${course.id}/${safe}`;
    const { error } = await supabase.storage
      .from("intake-uploads")
      .upload(path, file, { contentType: file.type, cacheControl: "3600" });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("intake-uploads").getPublicUrl(path);
    return data.publicUrl;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!witness.trim()) { toast.error("A witness is required."); return; }
    if (dateAchieved > today) { toast.error("Date cannot be in the future."); return; }
    setSubmitting(true);
    try {
      const photoUrls: string[] = [];
      for (const p of photos) photoUrls.push(await uploadOne(p, "photo"));
      const videoUrl = video ? await uploadOne(video, "video") : null;

      const { error } = await supabase.rpc("submit_public_entry", {
        _slug: course.slug,
        _golfer_name: golferName.trim(),
        _date_achieved: dateAchieved,
        _hole_number: holeNumber,
        _witness: witness.trim(),
        _yardage: yardage ? Number(yardage) : undefined,
        _club: club || undefined,
        _story: story || undefined,
        _handicap_at_time: handicap ? Number(handicap) : undefined,
        _favorite_hole: favHole ? Number(favHole) : undefined,
        _years_playing: yearsPlaying ? Number(yearsPlaying) : undefined,
        _prior_holes_in_one: priorAces ? Number(priorAces) : undefined,
        _golfer_email: email || undefined,
        _photo_urls: photoUrls,
        _video_url: videoUrl ?? undefined,
      });
      if (error) throw new Error(error.message);
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Your ace" required>
        <Field label="Your name" required>
          <input required value={golferName} onChange={(e) => setGolferName(e.target.value)} className={input} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <input
              required
              type="date"
              max={today}
              value={dateAchieved}
              onChange={(e) => setDateAchieved(e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Hole #" required>
            <select
              required
              value={holeNumber}
              onChange={(e) => setHoleNumber(Number(e.target.value))}
              className={input}
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Hole {n}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Witness" required hint="No ace gets posted without a witness.">
          <input
            required
            value={witness}
            onChange={(e) => setWitness(e.target.value)}
            placeholder="e.g. John Smith, playing partner"
            className={input}
          />
        </Field>
      </Section>

      <Section title="Details (optional)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yardage">
            <input type="number" min={0} max={1000} value={yardage} onChange={(e) => setYardage(e.target.value)} className={input} />
          </Field>
          <Field label="Club">
            <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="7-iron" className={input} />
          </Field>
        </div>
        <Field label="The story" hint="A few sentences — the wind, the bounce, the celebration.">
          <textarea rows={4} value={story} onChange={(e) => setStory(e.target.value)} className={input} />
        </Field>
      </Section>

      <Section title="About you (optional)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Handicap at the time">
            <input type="number" step="0.1" value={handicap} onChange={(e) => setHandicap(e.target.value)} className={input} />
          </Field>
          <Field label="Years playing">
            <input type="number" min={0} max={100} value={yearsPlaying} onChange={(e) => setYearsPlaying(e.target.value)} className={input} />
          </Field>
          <Field label="Favorite hole (1-27)">
            <input type="number" min={1} max={27} value={favHole} onChange={(e) => setFavHole(e.target.value)} className={input} />
          </Field>
          <Field label="Prior holes-in-one">
            <input type="number" min={0} max={50} value={priorAces} onChange={(e) => setPriorAces(e.target.value)} className={input} />
          </Field>
        </div>
        <Field label="Email" hint="So the course can let you know when it's on the board.">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </Field>
      </Section>

      <Section title={`Photos (up to ${MAX_PHOTOS})`}>
        <div className="grid grid-cols-3 gap-2">
          {photoPreviews.map((src, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs text-muted-foreground hover:bg-accent">
              <Upload className="h-4 w-4" />
              Add photo
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPhotosSelected(e.target.files)}
              />
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or HEIC. Max 8MB each.</p>
      </Section>

      {showVideo && (
        <Section title="Video (optional)">
          {video ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3 text-sm">
              <div className="truncate">
                <div className="truncate font-medium">{video.name}</div>
                <div className="text-xs text-muted-foreground">{(video.size / 1024 / 1024).toFixed(1)} MB</div>
              </div>
              <button type="button" onClick={() => setVideo(null)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed py-6 text-sm text-muted-foreground hover:bg-accent">
              <Upload className="h-4 w-4" />
              Add a short clip (max 60s, 50MB)
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => onVideoSelected(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </Section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Your entry will be reviewed before going live.</p>
          <button
            type="submit"
            disabled={submitting}
            style={{ backgroundColor: course.primary_color }}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "Submitting…" : "Submit ace"}
          </button>
        </div>
      </div>
    </form>
  );
}

const input =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-[var(--brand)]/30";

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {required && <span className="ml-1 text-destructive">*</span>}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(v.src);
      resolve(d);
    };
    v.onerror = () => reject(new Error("probe failed"));
    v.src = URL.createObjectURL(file);
  });
}
