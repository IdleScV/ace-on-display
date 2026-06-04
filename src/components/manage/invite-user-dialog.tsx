import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createInvitation,
  listInvitationsForEmail,
  sendInvitationEmail,
} from "@/lib/manage.functions";
import { listAllCourses } from "@/lib/courses.functions";

type Tier = "classic" | "interactive" | "estate" | "estate_interactive";

export function InviteUserDialog({
  onClose,
  showGoToInvitationsLink = false,
  defaultCourseId = "",
}: {
  onClose: () => void;
  showGoToInvitationsLink?: boolean;
  defaultCourseId?: string;
}) {
  const inviteFn = useServerFn(createInvitation);
  const checkFn = useServerFn(listInvitationsForEmail);
  const sendFn = useServerFn(sendInvitationEmail);
  const listCoursesFn = useServerFn(listAllCourses);
  const qc = useQueryClient();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"course_manager" | "superadmin">("course_manager");
  const [courseId, setCourseId] = useState<string>(defaultCourseId);
  const [grantSub, setGrantSub] = useState(false);
  const [tier, setTier] = useState<Tier>("interactive");
  const [boardCount, setBoardCount] = useState(1);
  const [perpetual, setPerpetual] = useState(true);
  const [endsAt, setEndsAt] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<{ id: string; url: string } | null>(null);
  const [existing, setExisting] = useState<any[]>([]);

  const { data: courses = [] } = useQuery({
    queryKey: ["all-courses"],
    queryFn: () => listCoursesFn(),
  });

  useEffect(() => {
    if (!email || !email.includes("@")) {
      setExisting([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = (await checkFn({ data: { email } } as any)) as any[];
        setExisting(r ?? []);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [email, checkFn]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = (await inviteFn({
        data: {
          email,
          role,
          course_id: role === "course_manager" ? courseId : null,
          grant_subscription_tier: grantSub ? tier : null,
          grant_subscription_board_count: grantSub ? boardCount : 1,
          grant_subscription_ends_at:
            grantSub && !perpetual && endsAt ? new Date(endsAt).toISOString() : null,
        },
      } as any)) as any;
      const url = `${window.location.origin}/accept-invite/${res.invitation.token}`;
      setCreated({ id: res.invitation.id, url });
      qc.invalidateQueries({ queryKey: ["manage-users"] });
      qc.invalidateQueries({ queryKey: ["manage-invitations"] });
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invitation created — link copied to clipboard");
      } catch {
        toast.success("Invitation created");
      }
    } catch (err: any) {
      const m: string = err.message || "";
      if (m.startsWith("INVITATION_DUPLICATE:")) {
        const parts = m.split(":");
        toast.error(parts.slice(2).join(":"));
      } else if (m.startsWith("USER_EXISTS:")) {
        toast.error(m.slice("USER_EXISTS:".length) + " Use the existing user instead.");
      } else {
        toast.error(m);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const sendEmail = async () => {
    if (!created) return;
    setSending(true);
    try {
      await sendFn({ data: { id: created.id, invite_url: created.url } } as any);
      toast.success("Invitation email sent");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New invitation</DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <p className="text-sm">Invitation created. Share this link:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={created.url}
                className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(created.url);
                  toast.success("Copied");
                }}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
            <button
              onClick={sendEmail}
              disabled={sending}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40"
            >
              <Mail className="h-4 w-4" /> {sending ? "Sending…" : "Send email"}
            </button>
            {showGoToInvitationsLink && (
              <p className="text-xs text-muted-foreground">
                Manage all invitations on the{" "}
                <Link
                  to="/admin/manage"
                  search={{ tab: "invitations" }}
                  className="underline hover:text-foreground"
                  onClick={onClose}
                >
                  invitations tab
                </Link>
                .
              </p>
            )}
            <DialogFooter>
              <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">
                Done
              </button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {existing.length > 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                  ⚠ A pending invitation already exists for this email.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="course_manager">Course Manager</option>
                <option value="superadmin">SuperAdmin</option>
              </select>
            </div>

            {role === "course_manager" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Course</label>
                <select
                  required
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a course…</option>
                  {(courses as any[]).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={grantSub}
                onChange={(e) => setGrantSub(e.target.checked)}
              />
              Optionally grant a subscription
            </label>

            {grantSub && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Tier</label>
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value as Tier)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="classic">Classic</option>
                      <option value="interactive">Interactive</option>
                      <option value="estate">Estate</option>
                      <option value="estate_interactive">Estate · Interactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Boards</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={boardCount}
                      onChange={(e) =>
                        setBoardCount(Math.max(1, parseInt(e.target.value || "1", 10)))
                      }
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={perpetual}
                    onChange={(e) => setPerpetual(e.target.checked)}
                  />
                  Perpetual (no end date)
                </label>
                {!perpetual && (
                  <input
                    type="date"
                    required
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                )}
              </div>
            )}

            <DialogFooter>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {submitting ? "Sending…" : "Create invitation"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
