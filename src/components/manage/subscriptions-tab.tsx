import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Gift,
  AlertTriangle,
  Ban,
  RefreshCw,
  CalendarPlus,
  ShieldAlert,
  Copy,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { listAllCourses } from "@/lib/courses.functions";
import { useAuth } from "@/lib/auth-context";
import {
  listSubscriptions,
  getSubscriptionDetail,
  createSubscription,
  updateSubscription,
  changeSubscriptionPlan,
  cancelSubscription,
  reactivateSubscription,
  extendSubscription,
  searchProfilesByEmail,
  createUserForBilling,
} from "@/lib/subscriptions.functions";

const TIERS = ["classic", "interactive", "estate", "estate_interactive"] as const;
type Tier = (typeof TIERS)[number];
const TIER_LABEL: Record<Tier, string> = {
  classic: "Classic",
  interactive: "Interactive",
  estate: "Estate",
  estate_interactive: "Estate + Interactive",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
  expired: "Expired",
};
const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-500/10 text-green-700 dark:text-green-400",
  trialing: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  past_due: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  canceled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};
const SOURCE_COLOR: Record<string, string> = {
  stripe: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  manual: "bg-secondary text-secondary-foreground",
  gifted: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
};

const PAGE_SIZE = 25;

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[value] ?? ""}`}>
      {STATUS_LABEL[value] ?? value}
    </span>
  );
}
function SourceBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs capitalize ${SOURCE_COLOR[value] ?? ""}`}>
      {value === "gifted" && <Gift className="h-3 w-3" />} {value}
    </span>
  );
}
function TierBadge({ value }: { value: string }) {
  return (
    <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {TIER_LABEL[value as Tier] ?? value}
    </span>
  );
}

// ---------------------------------------------------------------------------

export function SubscriptionsTab({
  focusSubscriptionId,
  onSelect,
}: {
  focusSubscriptionId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const listFn = useServerFn(listSubscriptions);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [sort, setSort] = useState<"created_at" | "starts_at" | "ends_at" | "plan_tier">(
    "created_at",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["manage-subs", search, status, tier, source, sort, sortDir, page],
    queryFn: () =>
      listFn({
        data: { search, status, tier, source, sort, sortDir, page, pageSize: PAGE_SIZE },
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
            placeholder="Search course name or billing email…"
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
          value={tier}
          onChange={(e) => {
            setTier(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All sources</option>
          <option value="stripe">Stripe</option>
          <option value="manual">Manual</option>
          <option value="gifted">Gifted</option>
        </select>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Create subscription
        </button>
        <button
          onClick={() => setGiftOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <Gift className="h-4 w-4" /> Gift subscription
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Billing user</th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort("plan_tier")}>
                Tier {sort === "plan_tier" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="px-4 py-2">Boards</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Status</th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort("starts_at")}>
                Starts {sort === "starts_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort("ends_at")}>
                Ends {sort === "ends_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort("created_at")}>
                Created {sort === "created_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
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
                  No subscriptions match the current filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelect(r.id)}
                className="cursor-pointer border-t transition hover:bg-muted/30"
              >
                <td className="px-4 py-2 font-medium">
                  <Link
                    to="/admin/course/$courseId"
                    params={{ courseId: r.course_id }}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
                  >
                    {r.course?.name ?? "(unknown)"}
                  </Link>
                  {r.course?.plan_override && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">
                      <ShieldAlert className="h-2.5 w-2.5" /> override
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{r.billing_user?.email ?? "—"}</td>
                <td className="px-4 py-2"><TierBadge value={r.plan_tier} /></td>
                <td className="px-4 py-2">{r.board_count}</td>
                <td className="px-4 py-2"><SourceBadge value={r.billing_source} /></td>
                <td className="px-4 py-2"><StatusBadge value={r.status} /></td>
                <td className="px-4 py-2 text-muted-foreground">{fmt(r.starts_at)}</td>
                <td className="px-4 py-2 text-muted-foreground">{fmt(r.ends_at)}</td>
                <td className="px-4 py-2 text-muted-foreground">{fmt(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>Page {page} of {lastPage} · {total} subscriptions</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(Math.min(lastPage, page + 1))} disabled={page === lastPage} className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <SubscriptionDetailDrawer
        subscriptionId={focusSubscriptionId}
        onClose={() => onSelect(null)}
      />
      {createOpen && (
        <CreateSubscriptionModal mode="create" onClose={() => setCreateOpen(false)} />
      )}
      {giftOpen && (
        <CreateSubscriptionModal mode="gift" onClose={() => setGiftOpen(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

function SubscriptionDetailDrawer({
  subscriptionId,
  onClose,
}: {
  subscriptionId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getSubscriptionDetail);
  const updateFn = useServerFn(updateSubscription);
  const cancelFn = useServerFn(cancelSubscription);
  const reactivateFn = useServerFn(reactivateSubscription);
  const extendFn = useServerFn(extendSubscription);

  const enabled = !!subscriptionId;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["manage-sub-detail", subscriptionId],
    enabled,
    queryFn: () => getFn({ data: { id: subscriptionId! } } as any),
  });

  const [notes, setNotes] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);

  useEffect(() => {
    if (!data) return;
    const s = data.subscription;
    setNotes(s.notes ?? "");
    setStartsAt(s.starts_at ? s.starts_at.slice(0, 10) : "");
    setEndsAt(s.ends_at ? s.ends_at.slice(0, 10) : "");
  }, [data?.subscription?.id]);

  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["manage-subs"] });
  };

  if (!enabled) return null;

  const s = data?.subscription;
  const isLive = s ? ["active", "trialing"].includes(s.status) : false;
  const canReactivate = s ? ["canceled", "expired"].includes(s.status) : false;
  const canExtend = s ? ["manual", "gifted"].includes(s.billing_source) : false;

  const saveDates = async () => {
    if (!s) return;
    try {
      await updateFn({
        data: {
          id: s.id,
          starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        },
      } as any);
      toast.success("Dates saved");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const saveNotes = async () => {
    if (!s) return;
    try {
      await updateFn({ data: { id: s.id, notes } } as any);
      toast.success("Notes saved");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const doCancel = async () => {
    if (!s) return;
    try {
      await cancelFn({ data: { id: s.id } } as any);
      toast.success("Subscription canceled");
      setConfirmCancel(false);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const doReactivate = async () => {
    if (!s) return;
    try {
      await reactivateFn({ data: { id: s.id, ends_at: null } } as any);
      toast.success("Subscription reactivated");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Sheet open={enabled} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Subscription detail</SheetTitle>
        </SheetHeader>
        {isLoading || !data || !s ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{data.course?.name ?? "(unknown course)"}</h2>
                <TierBadge value={s.plan_tier} />
                <StatusBadge value={s.status} />
              </div>
              {data.course?.plan_override ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>Course is on manual override — subscription tier does not control feature flags.</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Feature flags auto-sync from this subscription: <strong>has_touch={String(data.course?.has_touch)}</strong>, <strong>is_multi_board={String(data.course?.is_multi_board)}</strong>
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Plan</h3>
              <div className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">{TIER_LABEL[s.plan_tier as Tier]}</div>
                  <div className="text-xs text-muted-foreground">{s.board_count} board{s.board_count > 1 ? "s" : ""}</div>
                </div>
                <button
                  onClick={() => setPlanOpen(true)}
                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  Change plan
                </button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Billing</h3>
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <SourceBadge value={s.billing_source} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing user</span>
                  <span>{data.billing_user?.email ?? "—"}</span>
                </div>
                {s.stripe_subscription_id && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Stripe sub ID</span>
                    <code className="text-xs">{s.stripe_subscription_id}</code>
                  </div>
                )}
                {s.stripe_customer_id && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Stripe customer</span>
                    <code className="text-xs">{s.stripe_customer_id}</code>
                  </div>
                )}
                {s.billing_source === "gifted" && (
                  <>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="text-muted-foreground">Gifted by</span>
                      <span>{data.gifted_by?.email ?? "—"}</span>
                    </div>
                    {s.gift_reason && (
                      <div className="border-t pt-2 mt-2">
                        <p className="text-muted-foreground text-xs">Gift reason</p>
                        <p className="mt-1 text-sm">{s.gift_reason}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Dates</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">
                  <span className="text-muted-foreground">Starts at</span>
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-muted-foreground">Ends at</span>
                  <input
                    type="date"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <button
                onClick={saveDates}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
              >
                Save dates
              </button>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={saveNotes}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
              >
                Save notes
              </button>
            </section>

            <section className="space-y-2 border-t pt-4">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Lifecycle</h3>
              <div className="flex flex-wrap gap-2">
                {isLive && (
                  <button
                    onClick={() => setConfirmCancel(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Ban className="h-3.5 w-3.5" /> Cancel subscription
                  </button>
                )}
                {canReactivate && (
                  <button
                    onClick={doReactivate}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reactivate
                  </button>
                )}
                {canExtend && isLive && (
                  <button
                    onClick={() => setExtendOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> Extend
                  </button>
                )}
              </div>
            </section>

            <section className="space-y-2 border-t pt-4">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">History</h3>
              {data.events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No events yet.</p>
              ) : (
                <ol className="space-y-2">
                  {data.events.map((e: any) => (
                    <li key={e.id} className="rounded-md border p-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium capitalize">{e.event_type.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                      </div>
                      {(e.from_tier || e.to_tier) && (
                        <p className="text-muted-foreground mt-1">
                          {e.from_tier ? TIER_LABEL[e.from_tier as Tier] ?? e.from_tier : "—"} → {e.to_tier ? TIER_LABEL[e.to_tier as Tier] ?? e.to_tier : "—"}
                        </p>
                      )}
                      {(e.from_board_count != null || e.to_board_count != null) &&
                        e.from_board_count !== e.to_board_count && (
                          <p className="text-muted-foreground">
                            Boards: {e.from_board_count ?? "—"} → {e.to_board_count ?? "—"}
                          </p>
                        )}
                      {e.notes && <p className="mt-1">{e.notes}</p>}
                      {e.actor && (
                        <p className="text-muted-foreground mt-1">by {e.actor.email}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </SheetContent>

      {s && (
        <ChangePlanDialog
          open={planOpen}
          onClose={() => setPlanOpen(false)}
          subscription={s}
          onDone={refresh}
        />
      )}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This sets status to canceled and ends the subscription immediately. Course feature flags will revert.
          </p>
          <DialogFooter>
            <button onClick={() => setConfirmCancel(false)} className="rounded-md border px-3 py-1.5 text-sm">Keep it</button>
            <button onClick={doCancel} className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90">Cancel subscription</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {s && (
        <ExtendDialog
          open={extendOpen}
          onClose={() => setExtendOpen(false)}
          subscriptionId={s.id}
          currentEndsAt={s.ends_at}
          extendFn={extendFn}
          onDone={refresh}
        />
      )}
    </Sheet>
  );
}

function ChangePlanDialog({
  open,
  onClose,
  subscription,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  subscription: any;
  onDone: () => void;
}) {
  const fn = useServerFn(changeSubscriptionPlan);
  const [tier, setTier] = useState<Tier>(subscription.plan_tier);
  const [boardCount, setBoardCount] = useState<number>(subscription.board_count);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTier(subscription.plan_tier);
    setBoardCount(subscription.board_count);
    setNotes("");
  }, [subscription.id, open]);

  const submit = async () => {
    setBusy(true);
    try {
      await fn({ data: { id: subscription.id, plan_tier: tier, board_count: boardCount, notes } } as any);
      toast.success("Plan updated");
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Change plan</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="text-muted-foreground">Tier</span>
            <select value={tier} onChange={(e) => setTier(e.target.value as Tier)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Board count</span>
            <input type="number" min={1} max={50} value={boardCount} onChange={(e) => setBoardCount(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Note (optional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40">Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtendDialog({
  open,
  onClose,
  subscriptionId,
  currentEndsAt,
  extendFn,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  subscriptionId: string;
  currentEndsAt: string | null;
  extendFn: (args: any) => Promise<any>;
  onDone: () => void;
}) {
  const [newDate, setNewDate] = useState<string>(currentEndsAt ? currentEndsAt.slice(0, 10) : "");
  const [perpetual, setPerpetual] = useState(!currentEndsAt);

  useEffect(() => {
    setNewDate(currentEndsAt ? currentEndsAt.slice(0, 10) : "");
    setPerpetual(!currentEndsAt);
  }, [currentEndsAt, open]);

  const addDays = (days: number) => {
    const base = newDate && !perpetual ? new Date(newDate) : new Date();
    base.setDate(base.getDate() + days);
    setNewDate(base.toISOString().slice(0, 10));
    setPerpetual(false);
  };

  const submit = async () => {
    try {
      await extendFn({
        data: {
          id: subscriptionId,
          ends_at: perpetual ? null : new Date(newDate).toISOString(),
        },
      });
      toast.success("Subscription extended");
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Extend subscription</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            <button onClick={() => addDays(30)} className="rounded-md border px-2 py-1 text-xs hover:bg-accent">+30 days</button>
            <button onClick={() => addDays(90)} className="rounded-md border px-2 py-1 text-xs hover:bg-accent">+90 days</button>
            <button onClick={() => addDays(365)} className="rounded-md border px-2 py-1 text-xs hover:bg-accent">+1 year</button>
            <button onClick={() => setPerpetual(true)} className="rounded-md border px-2 py-1 text-xs hover:bg-accent">Perpetual</button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={perpetual} onChange={(e) => setPerpetual(e.target.checked)} />
            No end date (perpetual)
          </label>
          {!perpetual && (
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
          <button onClick={submit} disabled={!perpetual && !newDate} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40">Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Create / Gift modal
// ---------------------------------------------------------------------------

function CreateSubscriptionModal({
  mode,
  onClose,
}: {
  mode: "create" | "gift";
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listCoursesFn = useServerFn(listAllCourses);
  const searchFn = useServerFn(searchProfilesByEmail);
  const createUserFn = useServerFn(createUserForBilling);
  const createFn = useServerFn(createSubscription);

  const [courseId, setCourseId] = useState("");
  const [billingUser, setBillingUser] = useState<{ id: string; email: string } | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [newUserMode, setNewUserMode] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [tier, setTier] = useState<Tier>("interactive");
  const [boardCount, setBoardCount] = useState(1);
  const [source, setSource] = useState<"manual" | "gifted" | "stripe">(
    mode === "gift" ? "gifted" : "manual",
  );
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState("");
  const [perpetual, setPerpetual] = useState(mode === "gift");
  const [notes, setNotes] = useState("");
  const [giftReason, setGiftReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ["all-courses"],
    queryFn: () => listCoursesFn(),
  });

  // Warn if course already has an active sub
  const conflict = useMemo(() => {
    if (!courseId) return null;
    const c = (courses as any[]).find((x) => x.id === courseId);
    return c ?? null;
  }, [courseId, courses]);

  // Autocomplete billing user
  useEffect(() => {
    if (!userQuery || userQuery.length < 2) {
      setUserResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = (await searchFn({ data: { q: userQuery } } as any)) as any[];
        setUserResults(r ?? []);
      } catch {/* */}
    }, 250);
    return () => clearTimeout(t);
  }, [userQuery, searchFn]);

  const setPreset = (days: number | null) => {
    if (days === null) {
      setPerpetual(true);
      setEndsAt("");
      return;
    }
    setPerpetual(false);
    const d = new Date();
    d.setDate(d.getDate() + days);
    setEndsAt(d.toISOString().slice(0, 10));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return toast.error("Pick a course");
    if (source === "gifted" && !giftReason.trim()) return toast.error("Gift reason required");
    setBusy(true);
    try {
      let userId = billingUser?.id;
      if (newUserMode) {
        if (!newUserEmail) throw new Error("Email required for new user");
        const res = (await createUserFn({
          data: { email: newUserEmail, display_name: newUserName },
        } as any)) as any;
        userId = res.profile.id;
        if (res.invitation?.token) {
          setInviteLink(`${window.location.origin}/accept-invite/${res.invitation.token}`);
        }
      }
      if (!userId) throw new Error("Pick or create a billing user");

      await createFn({
        data: {
          course_id: courseId,
          billing_user_id: userId,
          plan_tier: tier,
          board_count: boardCount,
          billing_source: source === "stripe" ? "manual" : source,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: perpetual || !endsAt ? null : new Date(endsAt).toISOString(),
          notes,
          gift_reason: source === "gifted" ? giftReason : "",
        },
      } as any);
      toast.success(mode === "gift" ? "Gifted subscription created" : "Subscription created");
      qc.invalidateQueries({ queryKey: ["manage-subs"] });
      if (!inviteLink) onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "gift" ? "Gift subscription" : "Create subscription"}</DialogTitle>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-sm">Subscription created. Share the invitation link with the new user:</p>
            <div className="flex gap-2">
              <input readOnly value={inviteLink} className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs" />
              <button
                onClick={async () => { await navigator.clipboard.writeText(inviteLink); toast.success("Copied"); }}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
            <DialogFooter>
              <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">Done</button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Course</label>
              <select required value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Pick a course…</option>
                {(courses as any[]).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {conflict && (
                <CourseConflictWarning courseId={courseId} courseName={conflict.name} />
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Billing user</label>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <button type="button" onClick={() => setNewUserMode(false)} className={`rounded-md border px-2 py-1 ${!newUserMode ? "bg-accent" : ""}`}>Existing user</button>
                <button type="button" onClick={() => setNewUserMode(true)} className={`rounded-md border px-2 py-1 ${newUserMode ? "bg-accent" : ""}`}>Create new user</button>
              </div>
              {!newUserMode ? (
                <div className="mt-2">
                  {billingUser ? (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>{billingUser.email}</span>
                      <button type="button" onClick={() => { setBillingUser(null); setUserQuery(""); }} className="text-xs text-muted-foreground hover:text-destructive">change</button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="search"
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        placeholder="Search by email or name…"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      {userResults.length > 0 && (
                        <div className="mt-1 max-h-40 overflow-y-auto rounded-md border bg-card">
                          {userResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => { setBillingUser(u); setUserResults([]); }}
                              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                            >
                              {u.email} {u.display_name ? <span className="text-muted-foreground">— {u.display_name}</span> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="email" required={newUserMode}
                    value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    value={newUserName} onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Display name (optional)"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs">
                <span className="text-muted-foreground">Tier</span>
                <select value={tier} onChange={(e) => setTier(e.target.value as Tier)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">Boards</span>
                <input type="number" min={1} max={50} value={boardCount} onChange={(e) => setBoardCount(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Source</label>
              {mode === "gift" ? (
                <p className="mt-1 text-sm rounded-md border bg-muted px-3 py-2">Gifted (locked)</p>
              ) : (
                <select value={source} onChange={(e) => setSource(e.target.value as any)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="manual">Manual</option>
                  <option value="stripe" disabled title="Coming soon">Stripe (coming soon)</option>
                  <option value="gifted">Gifted</option>
                </select>
              )}
            </div>

            {source === "gifted" && (
              <label className="block text-xs">
                <span className="text-muted-foreground">Gift reason (required)</span>
                <textarea
                  required value={giftReason} onChange={(e) => setGiftReason(e.target.value)}
                  rows={2}
                  placeholder="Founding member courtesy / Conference giveaway / Partner program…"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs">
                <span className="text-muted-foreground">Starts at</span>
                <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">Ends at</span>
                <input type="date" disabled={perpetual} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" />
              </label>
            </div>
            <div className="flex flex-wrap gap-1 text-xs">
              <button type="button" onClick={() => setPreset(30)} className="rounded-md border px-2 py-1 hover:bg-accent">+30 days</button>
              <button type="button" onClick={() => setPreset(90)} className="rounded-md border px-2 py-1 hover:bg-accent">+90 days</button>
              <button type="button" onClick={() => setPreset(365)} className="rounded-md border px-2 py-1 hover:bg-accent">+1 year</button>
              <button type="button" onClick={() => setPreset(null)} className="rounded-md border px-2 py-1 hover:bg-accent">Perpetual</button>
            </div>

            <label className="block text-xs">
              <span className="text-muted-foreground">Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </label>

            <DialogFooter>
              <button type="button" onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
                {mode === "gift" ? "Gift subscription" : "Create"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CourseConflictWarning({ courseId, courseName }: { courseId: string; courseName: string }) {
  const listFn = useServerFn(listSubscriptions);
  const { data } = useQuery({
    queryKey: ["conflict-check", courseId],
    queryFn: () =>
      listFn({ data: { status: "active", pageSize: 1 } } as any).then((r: any) => ({
        ...r,
        rows: (r.rows ?? []).filter((s: any) => s.course_id === courseId),
      })),
    enabled: !!courseId,
  });
  const existing = data?.rows?.[0];
  if (!existing) return null;
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span>
        {courseName} already has an active {TIER_LABEL[existing.plan_tier as Tier]} subscription. Cancel it first, or upgrade it via the existing subscription's detail drawer.
      </span>
    </div>
  );
}
