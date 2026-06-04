import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Lock } from "lucide-react";
import { hasFeature } from "@/lib/features";

export function EmbedShare({
  slug,
  course,
}: {
  slug: string;
  course: { has_touch?: boolean | null; is_multi_board?: boolean | null };
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const unlocked = hasFeature(
    {
      has_touch: !!course.has_touch,
      is_multi_board: !!course.is_multi_board,
    },
    "embed_widget",
  );

  if (!unlocked) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/30 p-4 text-sm">
        <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <div className="font-medium">Embed locked</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Upgrade to <strong>Interactive</strong> or <strong>Estate</strong> to embed
            your hole-in-one board on your course's website.
          </p>
        </div>
      </div>
    );
  }

  const url = origin ? `${origin}/${slug}/embed` : `/${slug}/embed`;
  const snippet = `<iframe
  src="${url}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; max-width: 800px;"
></iframe>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Embed snippet copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        readOnly
        value={snippet}
        rows={7}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-md border bg-muted/30 p-3 font-mono text-xs text-muted-foreground focus:border-primary focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-accent"
        >
          <Copy className="h-3.5 w-3.5" /> Copy snippet
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-accent"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Preview
        </a>
        <span className="text-[11px] text-muted-foreground">
          Paste into any HTML page on your course's website.
        </span>
      </div>
    </div>
  );
}
