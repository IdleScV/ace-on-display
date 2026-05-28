import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listCourseHoles, updateHoleMedia } from "@/lib/holes.functions";
import { Image as ImageIcon, Video, Trash2, Loader2, Upload, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";


const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

type HoleRow = {
  id: string;
  hole_number: number;
  par: number;
  yardage: number | null;
  topdown_url: string | null;
  video_url: string | null;
};

export function HoleMediaEditor({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCourseHoles);

  const { data: holes = [], isLoading } = useQuery({
    queryKey: ["course-holes-media", courseId],
    queryFn: () => listFn({ data: { course_id: courseId } } as any) as Promise<HoleRow[]>,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (holes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No aceable holes defined yet. Add some in Settings first.
      </p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {holes.map((h) => (
        <HoleCard key={h.id} hole={h} courseId={courseId} onChange={() =>
          qc.invalidateQueries({ queryKey: ["course-holes-media", courseId] })
        } />
      ))}
    </div>
  );
}

function HoleCard({
  hole,
  courseId,
  onChange,
}: {
  hole: HoleRow;
  courseId: string;
  onChange: () => void;
}) {
  const updateFn = useServerFn(updateHoleMedia);
  const [busy, setBusy] = useState<"image" | "video" | null>(null);

  async function upload(kind: "image" | "video", file: File) {
    const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > limit) {
      toast.error(`Max ${kind === "image" ? "8 MB" : "100 MB"}`);
      return;
    }
    setBusy(kind);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `${courseId}/hole-${hole.hole_number}/${kind}-${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("hole-media")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        toast.error(error.message);
        return;
      }
      const { data } = supabase.storage.from("hole-media").getPublicUrl(path);
      await updateFn({
        data: { id: hole.id, [kind === "image" ? "topdown_url" : "video_url"]: data.publicUrl },
      } as any);
      toast.success(`${kind === "image" ? "Top-down" : "Video"} updated`);
      onChange();
    } finally {
      setBusy(null);
    }
  }

  async function clear(kind: "image" | "video") {
    setBusy(kind);
    try {
      await updateFn({
        data: { id: hole.id, [kind === "image" ? "topdown_url" : "video_url"]: null },
      } as any);
      onChange();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold">Hole #{hole.hole_number}</div>
        <div className="text-xs text-muted-foreground">
          Par {hole.par}
          {hole.yardage ? ` · ${hole.yardage} yd` : ""}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MediaSlot
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          label="Top-down view"
          accept="image/*"
          url={hole.topdown_url}
          busy={busy === "image"}
          previewTitle={`Hole ${hole.hole_number} — Top-down`}
          onUpload={(f) => upload("image", f)}
          onClear={() => clear("image")}
          renderPreview={(onOpen) =>
            hole.topdown_url ? (
              <PreviewButton onClick={onOpen}>
                <img
                  src={hole.topdown_url}
                  alt={`Hole ${hole.hole_number} top-down`}
                  className="aspect-video w-full rounded object-cover"
                />
              </PreviewButton>
            ) : null
          }
          renderFullView={() =>
            hole.topdown_url ? (
              <img
                src={hole.topdown_url}
                alt={`Hole ${hole.hole_number} top-down`}
                className="max-h-[80vh] w-full rounded object-contain"
              />
            ) : null
          }
        />
        <MediaSlot
          icon={<Video className="h-3.5 w-3.5" />}
          label="Video"
          accept="video/*"
          url={hole.video_url}
          busy={busy === "video"}
          previewTitle={`Hole ${hole.hole_number} — Video`}
          onUpload={(f) => upload("video", f)}
          onClear={() => clear("video")}
          renderPreview={(onOpen) =>
            hole.video_url ? (
              <div className="relative">
                <video
                  src={hole.video_url}
                  controls
                  preload="metadata"
                  className="aspect-video w-full rounded bg-black object-cover"
                />
                <button
                  type="button"
                  onClick={onOpen}
                  className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-80 hover:opacity-100"
                  title="Preview"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null
          }
          renderFullView={() =>
            hole.video_url ? (
              <video
                src={hole.video_url}
                controls
                autoPlay
                className="max-h-[80vh] w-full rounded bg-black object-contain"
              />
            ) : null
          }
        />
      </div>

    </div>
  );
}

function MediaSlot({
  icon,
  label,
  accept,
  url,
  busy,
  onUpload,
  onClear,
  preview,
}: {
  icon: React.ReactNode;
  label: string;
  accept: string;
  url: string | null;
  busy: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  preview: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="mb-1 flex items-center justify-between text-xs font-medium">
        <span className="inline-flex items-center gap-1">{icon} {label}</span>
        {url && (
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-40"
            title="Remove"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      {preview ?? (
        <div className="grid aspect-video w-full place-items-center rounded border border-dashed bg-muted/40 text-[11px] text-muted-foreground">
          None uploaded
        </div>
      )}
      <label className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-accent">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {url ? "Replace" : "Upload"}
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
    </div>
  );
}
