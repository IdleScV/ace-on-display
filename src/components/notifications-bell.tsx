import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { listNotifications, markNotificationsRead } from "@/lib/manage.functions";
import { useAuth } from "@/lib/auth-context";

export function NotificationsBell() {
  const { isSuperadmin } = useAuth();
  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationsRead);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn({ data: { limit: 20 } } as any),
    enabled: isSuperadmin,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!isSuperadmin) return null;
  const rows: any[] = (data as any)?.rows ?? [];
  const unread: number = (data as any)?.unread ?? 0;

  const markAll = async () => {
    await markFn({ data: { all: true } } as any);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const markOne = async (id: string) => {
    await markFn({ data: { ids: [id] } } as any);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-md border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {rows.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                You're all caught up.
              </p>
            )}
            {rows.map((n) => (
              <NotificationItem key={n.id} n={n} onClose={() => setOpen(false)} onMark={() => markOne(n.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({ n, onClose, onMark }: { n: any; onClose: () => void; onMark: () => void }) {
  const payload = n.payload ?? {};
  const { title, link } = renderNotification(n.type, payload);
  const unread = !n.read_at;
  return (
    <div className={`flex items-start gap-2 border-b px-3 py-2 text-sm ${unread ? "bg-primary/5" : ""}`}>
      <div className="flex-1 min-w-0">
        {link ? (
          <Link
            to={link.to as any}
            search={link.search as any}
            params={link.params as any}
            onClick={() => {
              if (unread) onMark();
              onClose();
            }}
            className="block hover:underline"
          >
            <p className="truncate">{title}</p>
          </Link>
        ) : (
          <p className="truncate">{title}</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          {new Date(n.created_at).toLocaleString()}
        </p>
      </div>
      {unread && (
        <button onClick={onMark} className="text-muted-foreground hover:text-foreground" aria-label="Mark read">
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function renderNotification(type: string, payload: any): { title: string; link?: any } {
  switch (type) {
    case "subscription_expiring":
      return {
        title: `${payload.course_name ?? "Course"} subscription expires in ${payload.days_remaining ?? "?"} day${payload.days_remaining === 1 ? "" : "s"}`,
        link: payload.subscription_id
          ? { to: "/admin/manage", search: { tab: "subscriptions", sub: payload.subscription_id } }
          : undefined,
      };
    case "subscription_canceled":
      return {
        title: `Subscription for ${payload.course_name ?? "course"} was canceled`,
        link: payload.subscription_id
          ? { to: "/admin/manage", search: { tab: "subscriptions", sub: payload.subscription_id } }
          : undefined,
      };
    case "invitation_accepted":
      return {
        title: `${payload.email ?? "User"} accepted your invitation${payload.course_name ? ` for ${payload.course_name}` : ""}`,
        link: payload.invitation_id
          ? { to: "/admin/manage", search: { tab: "invitations", invite: payload.invitation_id } }
          : undefined,
      };
    default:
      return { title: type };
  }
}
