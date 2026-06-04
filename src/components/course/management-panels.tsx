import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CreditCard,
  Gift,
  Mail,
  History,
  ShieldAlert,
  Users,
  Plus,
  Copy,
  X,
  Send,
  Trash2,
  Loader2,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  getCourseManagementSummary,
  setCoursePlanOverride,
} from "@/lib/course-management.functions";
import {
  cancelSubscription,
  createSubscription,
  searchProfilesByEmail,
  createUserForBilling,
} from "@/lib/subscriptions.functions";
import {
  resendInvitation,
  revokeInvitation,
} from "@/lib/manage.functions";
import { InviteUserDialog } from "@/components/manage/invite-user-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const TIER_LABEL: Record<string, string> = {
  classic: "Classic",
  interactive: "Interactive",
  estate: "Estate",
  estate_interactive: "Estate · Interactive",
};
const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  trialing: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  past_due: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  canceled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
        STATUS_TONE[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

export function CourseManagementPanels({ courseId }: { courseId: string }) {
  const summaryFn = useServerFn(getCourseManagementSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["course-mgmt-summary", courseId],
    queryFn: () => summaryFn({ data: { courseId } }),
  });

  if (isLoading || !data) {
    return (
      <Section title="Subscription" desc="Plan, billing and lifecycle.">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Section>
    );
  }

  return (
    <div className="space-y-6">
      <AuditBadge audit={data.lastAudit} />
      <SubscriptionSection courseId={courseId} summary={data} />
      <PlanOverrideSection courseId={courseId} course={data.course} />
      <AssignedUsersSection courseId={courseId} managers={data.managers} />
      <InvitationsSection courseId={courseId} invitations={data.invitations} />
    </div>
  );
}

function Section({
  title,
  desc,
  action,
  children,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
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

// ─── Audit badge ────────────────────────────────────────────────────────────
function AuditBadge({ audit }: { audit: any }) {
  if (!audit) return null;
  const actor = audit.actor_display_name || audit.actor_email || "system";
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      Last changed {new Date(audit.created_at).toLocaleString()} by <strong>{actor}</strong>
      <span className="text-muted-foreground">· {audit.entity} {audit.action}</span>
    </div>
  );
}

// ─── Subscription section ───────────────────────────────────────────────────
function SubscriptionSection({
  courseId,
  summary,
}: {
  courseId: string;
  summary: any;
}) {
  const qc = useQueryClient();
  const cancelFn = useServerFn(cancelSubscription);
  const active = summary.activeSubscription;
  const history = summary.history as any[];
  const [showHistory, setShowHistory] = useState(false);
  const [createOpen, setCreateOpen] = useState<"create" | "gift" | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["course-mgmt-summary", courseId] });
    qc.invalidateQueries({ queryKey: ["my-courses"] });
  };

  const onCancel = async () => {
    if (!active) return;
    if (!confirm("Cancel this subscription? Course feature toggles will revert.")) return;
    setBusy(true);
    try {
      await cancelFn({ data: { id: active.id } });
      toast.success("Subscription canceled");
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Subscription"
      desc="The active plan for this course. Changes sync to course feature toggles."
      action={
        <CreditCard className="h-5 w-5 text-muted-foreground" />
      }
    >
      {active ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cell label="Tier" value={TIER_LABEL[active.plan_tier] ?? active.plan_tier} />
            <Cell label="Boards" value={String(active.board_count)} />
            <Cell label="Status" value={<StatusBadge status={active.status} />} />
            <Cell label="Source" value={active.billing_source} />
            <Cell label="Started" value={fmtDate(active.starts_at)} />
            <Cell label="Ends" value={fmtDate(active.ends_at)} />
            <Cell
              label="Billing user"
              value={
                active.billing_user ? (
                  <span>
                    {active.billing_user.display_name || active.billing_user.email}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            {active.billing_source === "gifted" && (
              <Cell label="Gift reason" value={active.gift_reason || "—"} />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/manage"
              search={{ tab: "subscriptions", sub: active.id } as any}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Manage
            </Link>
            <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-background p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">No active subscription.</p>
          <div className="flex justify-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen("create")}>
              <Plus className="mr-1 h-4 w-4" /> Create subscription
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen("gift")}>
              <Gift className="mr-1 h-4 w-4" /> Gift subscription
            </Button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? "Hide" : "Show"} subscription history ({history.length})
          </button>
          {showHistory && (
            <div className="mt-3 overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Started</th>
                    <th className="px-3 py-2">Ended</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: any) => (
                    <tr key={h.id} className="border-t">
                      <td className="px-3 py-2">{TIER_LABEL[h.plan_tier] ?? h.plan_tier}</td>
                      <td className="px-3 py-2 text-muted-foreground">{h.billing_source}</td>
                      <td className="px-3 py-2"><StatusBadge status={h.status} /></td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(h.starts_at)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(h.ends_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {createOpen && (
        <CreateSubDialog
          courseId={courseId}
          mode={createOpen}
          onClose={() => setCreateOpen(null)}
          onSuccess={() => {
            setCreateOpen(null);
            invalidate();
          }}
        />
      )}
    </Section>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

// ─── Create/Gift subscription dialog ────────────────────────────────────────
function CreateSubDialog({
  courseId,
  mode,
  onClose,
  onSuccess,
}: {
  courseId: string;
  mode: "create" | "gift";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createFn = useServerFn(createSubscription);
  const searchFn = useServerFn(searchProfilesByEmail);
  const createUserFn = useServerFn(createUserForBilling);
  const [tier, setTier] = useState("interactive");
  const [boardCount, setBoardCount] = useState(1);
  const [email, setEmail] = useState("");
  const [billingUserId, setBillingUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSearch = async (q: string) => {
    setEmail(q);
    setBillingUserId(null);
    if (q.length < 3) {
      setMatches([]);
      return;
    }
    try {
      const r: any[] = await searchFn({ data: { query: q } } as any);
      setMatches(r ?? []);
    } catch {
      setMatches([]);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "gift" && !reason.trim()) {
      toast.error("Gift reason is required");
      return;
    }
    setSubmitting(true);
    try {
      let userId = billingUserId;
      if (!userId) {
        if (!email.includes("@")) throw new Error("Pick or enter a valid email");
        const created: any = await createUserFn({ data: { email } } as any);
        userId = created.userId ?? created.user_id ?? created.id;
      }
      await createFn({
        data: {
          course_id: courseId,
          billing_user_id: userId!,
          plan_tier: tier as any,
          board_count: boardCount,
          billing_source: mode === "gift" ? "gifted" : "manual",
          gift_reason: mode === "gift" ? reason : "",
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          starts_at: new Date().toISOString(),
          notes: "",
        },
      } as any);
      toast.success(mode === "gift" ? "Subscription gifted" : "Subscription created");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "gift" ? "Gift subscription" : "Create subscription"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Billing user email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => onSearch(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Search existing or enter new"
            />
            {matches.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover text-sm">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setBillingUserId(m.id);
                      setEmail(m.email);
                      setMatches([]);
                    }}
                    className="block w-full px-3 py-1.5 text-left hover:bg-accent"
                  >
                    {m.display_name ?? m.email}{" "}
                    <span className="text-xs text-muted-foreground">{m.email}</span>
                  </button>
                ))}
              </div>
            )}
            {!billingUserId && email.includes("@") && (
              <p className="mt-1 text-xs text-muted-foreground">
                Will create a new user with an invitation email.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
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
                onChange={(e) => setBoardCount(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          {mode === "gift" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Gift reason</label>
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ends at (optional)</label>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
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
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {submitting ? "Saving…" : mode === "gift" ? "Gift subscription" : "Create subscription"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Plan override ──────────────────────────────────────────────────────────
function PlanOverrideSection({
  courseId,
  course,
}: {
  courseId: string;
  course: { plan_override: boolean; has_touch: boolean; is_multi_board: boolean };
}) {
  const qc = useQueryClient();
  const overrideFn = useServerFn(setCoursePlanOverride);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await overrideFn({ data: { courseId, value: !course.plan_override } });
      toast.success(course.plan_override ? "Override disabled — toggles now follow subscription" : "Override enabled — toggles are now manual");
      qc.invalidateQueries({ queryKey: ["course-mgmt-summary", courseId] });
      qc.invalidateQueries({ queryKey: ["my-courses"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Plan override"
      desc="When enabled, the toggles in the Plan section are editable directly and the subscription trigger leaves them alone."
    >
      <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 hover:bg-accent/40">
        <input
          type="checkbox"
          className="mt-1"
          checked={course.plan_override}
          disabled={busy}
          onChange={toggle}
        />
        <span className="flex-1">
          <span className="block text-sm font-medium">Manual plan override</span>
          <span className="block text-xs text-muted-foreground">
            {course.plan_override
              ? "Active — the Plan toggles ignore subscription changes."
              : "Off — plan flags are managed by the active subscription. Toggle override to set manually."}
          </span>
        </span>
      </label>
    </Section>
  );
}

// ─── Assigned users ─────────────────────────────────────────────────────────
function AssignedUsersSection({
  courseId,
  managers,
}: {
  courseId: string;
  managers: any[];
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <Section
      title="Assigned course managers"
      desc="Users who can edit this course."
      action={
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Invite manager
        </Button>
      }
    >
      {managers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No managers assigned yet.</p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Last login</th>
                <th className="px-3 py-2">Subscription</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.user_id} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {m.display_name ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{m.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {m.last_login_at ? new Date(m.last_login_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {m.owned_subscription_id ? (
                      <Link
                        to="/admin/manage"
                        search={{ tab: "subscriptions", sub: m.owned_subscription_id } as any}
                        className="text-xs text-primary hover:underline"
                      >
                        View subscription ↗
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {inviteOpen && (
        <InviteUserDialog
          onClose={() => setInviteOpen(false)}
          showGoToInvitationsLink
          defaultCourseId={courseId}
        />
      )}
    </Section>
  );
}

// ─── Invitations ────────────────────────────────────────────────────────────
function InvitationsSection({
  courseId,
  invitations,
}: {
  courseId: string;
  invitations: any[];
}) {
  const qc = useQueryClient();
  const resendFn = useServerFn(resendInvitation);
  const revokeFn = useServerFn(revokeInvitation);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = invitations.filter((i) => i.status === "pending");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["course-mgmt-summary", courseId] });

  const onResend = async (id: string) => {
    setBusyId(id);
    try {
      const r: any = await resendFn({ data: { id } } as any);
      const url = `${window.location.origin}/invitation/${r.token ?? r.invitation?.token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("New link copied to clipboard");
      } catch {
        toast.success("Invitation resent");
      }
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const onRevoke = async (id: string) => {
    if (!confirm("Revoke this invitation? The link will stop working.")) return;
    setBusyId(id);
    try {
      await revokeFn({ data: { id } } as any);
      toast.success("Invitation revoked");
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const onCopy = async (token: string) => {
    const url = `${window.location.origin}/invitation/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Section
      title="Invitations"
      desc="Pending invitations targeting this course."
      action={
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New invitation
        </Button>
      }
    >
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending invitations.</p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Grant</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{i.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">{i.role}</td>
                  <td className="px-3 py-2 text-xs">
                    {i.grant_subscription_tier ? (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">
                        <Gift className="mr-0.5 inline h-3 w-3" />
                        {TIER_LABEL[i.grant_subscription_tier] ?? i.grant_subscription_tier}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(i.expires_at)}</td>
                  <td className="px-3 py-2"><StatusBadge status={i.status} /></td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => onCopy(i.token)}
                        className="rounded-md border p-1.5 hover:bg-accent"
                        title="Copy link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onResend(i.id)}
                        disabled={busyId === i.id}
                        className="rounded-md border p-1.5 hover:bg-accent disabled:opacity-40"
                        title="Resend"
                      >
                        {busyId === i.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onRevoke(i.id)}
                        disabled={busyId === i.id}
                        className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                        title="Revoke"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {inviteOpen && (
        <InviteUserDialog
          onClose={() => setInviteOpen(false)}
          showGoToInvitationsLink
          defaultCourseId={courseId}
        />
      )}
    </Section>
  );
}
