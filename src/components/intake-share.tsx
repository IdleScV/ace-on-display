import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, QrCode } from "lucide-react";

export function IntakeShare({ slug, courseName }: { slug: string; courseName: string }) {
  const [origin, setOrigin] = useState("");
  const [showQR, setShowQR] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}/${slug}/submit` : `/${slug}/submit`;

  useEffect(() => {
    if (showQR && canvasRef.current && origin) {
      QRCode.toCanvas(canvasRef.current, url, { width: 260, margin: 2 }).catch(() => {});
    }
  }, [showQR, url, origin]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Intake URL copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const downloadQR = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${slug}-intake-qr.png`;
      a.click();
    } catch {
      toast.error("Couldn't generate QR");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <code className="flex-1 truncate text-xs text-muted-foreground">{url}</code>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
        >
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </a>
        <button
          onClick={() => setShowQR((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
        >
          <QrCode className="h-3.5 w-3.5" /> {showQR ? "Hide" : "Show"} QR
        </button>
      </div>

      {showQR && (
        <div className="flex flex-col items-center gap-3 rounded-md border bg-card p-4">
          <canvas ref={canvasRef} className="rounded-md" aria-label={`QR code for ${courseName} intake form`} />
          <button
            onClick={downloadQR}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" /> Download PNG
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Print and place near the clubhouse — golfers can scan to submit their ace.
          </p>
        </div>
      )}
    </div>
  );
}
