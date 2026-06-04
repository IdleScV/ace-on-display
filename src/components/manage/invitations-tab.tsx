import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Copy,
  Mail,
  RefreshCw,
  Ban,
  CalendarPlus,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldAlert,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listInvitations,
  getInvitationDetail,
  resendInvitation,
  revokeInvitation,
  extendInvitation,
  sendInvitationEmail,
} from "@/lib/manage.functions";
import { InviteUserDialog } from "@/components/manage/invite-user-dialog";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  accepted: "bg-green-500/10 text-green-700 dark:text-green-400",
  expired: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/10 text-destructive",
};
const ROLE_LABEL: Record<string, string> = {
  course_manager: "Course Manager",
  superadmin: "SuperAdmin",
};
const TIER_LABEL: Record<string, string> = {
  classic: "Classic",
  interactive: "Interactive",
  estate: "Estate",
  estate_interactive: "Estate + Interactive",
};

const PAGE_SIZE = 50;

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}
function fmtFull(d?: string | null) {
  return d ? new Date(d).toLocaleString() : "—";
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[value] ?? ""}`}>
      {STATUS_LABEL[value] ?? value}
    </span>
  );
}
function RoleBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
        value === "superadmin"
          ? "bg-primary/10 text-primary"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      {ROLE_LABEL[value] ?? value}
    </span>
  );
}

export function InvitationsTab({
  focusInvitationId,
  onSelect,
}: {
  focusInvitationId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const listFn = useServerFn(listInvitations);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [role, setRole] = useState<string>("all");
  const [sort, setSort] = useState<"created_at" | "expires_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["manage-invitations", search, status, role, sort, sortDir, page],
    queryFn: () =>
      listFn({
        data: { search, status, role, sort, sortDir, page, pageSize: PAGE_SIZE },
      } as any),
  });

  const rows = (data?.rows ?? []) as any[];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (col: typeof sort) => {
    if (sort === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSort(col);
      setSortDir("desc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by email…"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All roles</option>
          <option value="course_manager">Course Manager</option>
          <option value="superadmin">SuperAdmin</option>
        </select>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New invitation
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Grant</th>
              <th className="px-4 py-2">Status</th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort("created_at")}>
                Created {sort === "created_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort("expires_at")}>
                Expires {sort === "expires_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="px-4 py-2">Accepted</th>
              <th className="px-4 py-2">Created by</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No invitations match the current filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelect(r.id)}
                className="cursor-pointer border-t transition hover:bg-muted/30"
              >
                <td className="px-4 py-2 font-medium">{r.email}</td>
                <td className="px-4 py-2"><RoleBadge value={r.role} /></td>
                <td className="px-4 py-2">
                  {r.course ? (
                    <Link
                      to="/admin/course/$courseId"
                      params={{ courseId: r.course.id }}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {r.course.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.grant_subscription_tier ? (
                    <span className="inline-block rounded-md bg-pink-500/10 px-2 py-0.5 text-xs font-medium text-pink-700 dark:text-pink-400">
                      {TIER_LABEL[r.grant_subscription_tier] ?? r.grant_subscription_tier}
                      {r.grant_subscription_board_count > 1
                        ? ` · ${r.grant_subscription_board_count}b`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2"><StatusBadge value={r.status} /></td>
                <td className="px-4 py-2 text-muted-foreground">{fmt(r.created_at)}</td>
                <td className="px-4 py-2 text-muted-foreground">{fmt(r.expires_at)}</td>
                <td className="px-4 py-2 text-muted-foreground">{fmt(r.accepted_at)}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {r.created_by?.email ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>Page {page} of {lastPage} · {total} invitations</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(Math.min(lastPage, page + 1))}
                disabled={page === lastPage}
                className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <InvitationDetailDrawer
        invitationId={focusInvitationId}
        onClose={() => onSelect(null)}
      />
      {createOpen && (
        <InviteUserDialog
          onClose={() => setCreateOpen(false)}
          showGoToInvitationsLink={false}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

function InvitationDetailDrawer({
  invitationId,
  onClose,
}: {
  invitationId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getInvitationDetail);
  const resendFn = useServerFn(resendInvitation);
  const revokeFn = useServerFn(revokeInvitation);
  const extendFn = useServerFn(extendInvitation);
  const sendFn = useServerFn(sendInvitationEmail);

  const enabled = !!invitationId;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["manage-invitation-detail", invitationId],
    enabled,
    queryFn: () => getFn({ data: { id: invitationId! } } as any),
  });

  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["manage-invitations"] });
  };

  if (!enabled) return null;
  const inv = data?.invitation;
  const url = inv ? `${window.location.origin}/accept-invite/${inv.token}` : "";
  const canResend = inv && inv.status !== "accepted";
  const canRevoke = inv && inv.status === "pending";

  const doResend = async () => {
    if (!inv) return;
    try {
      await resendFn({ data: { id: inv.id } } as any);
      toast.success("Invitation regenerated — old link no longer works");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const doRevoke = async () => {
    if (!inv) return;
    try {
      await revokeFn({ data: { id: inv.id } } as any);
      toast.success("Invitation revoked");
      setConfirmRevoke(false);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const doSendEmail = async () => {
    if (!inv) return;
    setSending(true);
    try {
      await sendFn({ data: { id: inv.id, invite_url: url } } as any);
      toast.success("Invitation email sent");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };
  const copyUrl = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Copied");
  };

  return (
    <Sheet open={enabled} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Invitation</SheetTitle>
        </SheetHeader>
        {isLoading || !data || !inv ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{inv.email}</h2>
                <StatusBadge value={inv.status} />
                <RoleBadge value={inv.role} />
              </div>
              {data.course && (
                <p className="text-sm text-muted-foreground">
                  Course: <strong>{data.course.name}</strong>
                </p>
              )}
              {inv.grant_subscription_tier && (
                <div className="rounded-md border border-pink-500/30 bg-pink-500/5 p-2 text-xs text-pink-700 dark:text-pink-400">
                  Grants {TIER_LABEL[inv.grant_subscription_tier] ?? inv.grant_subscription_tier}
                  {(inv.grant_subscription_board_count ?? 1) > 1
                    ? ` · ${inv.grant_subscription_board_count} boards`
                    : ""}
                  {inv.grant_subscription_ends_at
                    ? ` · ends ${fmt(inv.grant_subscription_ends_at)}`
                    : " · perpetual"}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Invitation URL
              </h3>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs"
                />
                <button
                  onClick={copyUrl}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <Copy className="h-4 w-4" /> Copy
                </button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Timeline</h3>
              <ol className="space-y-2">
                <TimelineItem
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  active
                  label="Created"
                  at={inv.created_at}
                  by={data.created_by?.email}
                />
                <TimelineItem
                  icon={<Mail className="h-3.5 w-3.5" />}
                  active
                  label="Sent"
                  at={inv.created_at}
                  by="Manual — use Send email"
                />
                {inv.status === "accepted" && (
                  <TimelineItem
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    active
                    label="Accepted"
                    at={inv.accepted_at}
                    by={data.accepted_by?.email}
                  />
                )}
                {inv.status === "expired" && (
                  <TimelineItem
                    icon={<Clock className="h-3.5 w-3.5" />}
                    active
                    label="Expired"
                    at={inv.expires_at}
                  />
                )}
                {inv.status === "revoked" && (
                  <TimelineItem
                    icon={<XCircle className="h-3.5 w-3.5" />}
                    active
                    label="Revoked"
                    at={inv.revoked_at}
                    by={data.revoked_by?.email}
                  />
                )}
              </ol>
              <p className="text-xs text-muted-foreground">
                Expires {fmtFull(inv.expires_at)}
              </p>
            </section>

            <section className="space-y-2 border-t pt-4">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={doSendEmail}
                  disabled={sending}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
                >
                  <Mail className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send email"}
                </button>
                {canResend && (
                  <button
                    onClick={doResend}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Resend (new token)
                  </button>
                )}
                {canResend && (
                  <button
                    onClick={() => setExtendOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> Extend expiration
                  </button>
                )}
                {canRevoke && (
                  <button
                    onClick={() => setConfirmRevoke(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Ban className="h-3.5 w-3.5" /> Revoke
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </SheetContent>

      <Dialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke invitation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This is irreversible. The recipient will no longer be able to accept this invitation.
          </p>
          <DialogFooter>
            <button
              onClick={() => setConfirmRevoke(false)}
              className="rounded-md border px-3 py-1.5 text-sm"
            >
              Keep it
            </button>
            <button
              onClick={doRevoke}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              <ShieldAlert className="mr-1 inline h-3.5 w-3.5" /> Revoke
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {inv && (
        <ExtendInvitationDialog
          open={extendOpen}
          onClose={() => setExtendOpen(false)}
          currentExpiresAt={inv.expires_at}
          onConfirm={async (iso) => {
            try {
              await extendFn({ data: { id: inv.id, expires_at: iso } } as any);
              toast.success("Expiration extended");
              setExtendOpen(false);
              refresh();
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        />
      )}
    </Sheet>
  );
}

function TimelineItem({
  icon,
  label,
  at,
  by,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  at?: string | null;
  by?: string | null;
  active?: boolean;
}) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full ${
          active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground">
          {fmtFull(at)}
          {by ? ` — ${by}` : ""}
        </div>
      </div>
    </li>
  );
}

function ExtendInvitationDialog({
  open,
  onClose,
  currentExpiresAt,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  currentExpiresAt: string | null;
  onConfirm: (iso: string) => void;
}) {
  const [date, setDate] = useState<string>(() =>
    (currentExpiresAt ?? new Date().toISOString()).slice(0, 10),
  );

  useEffect(() => {
    setDate((currentExpiresAt ?? new Date().toISOString()).slice(0, 10));
  }, [currentExpiresAt, open]);

  const addDays = (days: number) => {
    const base = new Date();
    base.setDate(base.getDate() + days);
    setDate(base.toISOString().slice(0, 10));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend expiration</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1 text-xs">
            <button
              onClick={() => addDays(7)}
              className="rounded-md border px-2 py-1 hover:bg-accent"
            >
              +7 days
            </button>
            <button
              onClick={() => addDays(14)}
              className="rounded-md border px-2 py-1 hover:bg-accent"
            >
              +14 days
            </button>
            <button
              onClick={() => addDays(30)}
              className="rounded-md border px-2 py-1 hover:bg-accent"
            >
              +30 days
            </button>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(new Date(date).toISOString())}
            disabled={!date}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
