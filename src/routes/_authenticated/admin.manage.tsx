import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Search,
  UserPlus,
  Trash2,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Copy,
  X,
  Plus,
} from "lucide-react";
import {
  listUsers,
  getUserDetail,
  updateUserDisplayName,
  changeUserRole,
  assignUserCourse,
  unassignUserCourse,
  suspendUser,
  reactivateUser,
  deleteUser,
  sendPasswordResetForUser,
  createInvitation,
  listInvitationsForEmail,
} from "@/lib/manage.functions";
import { SubscriptionsTab } from "@/components/manage/subscriptions-tab";
import { listAllCourses } from "@/lib/courses.functions";
import { useAuth } from "@/lib/auth-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const TABS = ["users", "courses", "subscriptions", "invitations"] as const;
type Tab = (typeof TABS)[number];

const searchSchema = z.object({
  tab: z.enum(TABS).catch("users").default("users"),
  user: z.string().uuid().optional(),
  sub: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/manage")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ManagePage,
  head: () => ({ meta: [{ title: "Manage — Ace Board" }] }),
});

function ManagePage() {
  const { isSuperadmin } = useAuth();
  const navigate = useNavigate();
  const { tab, user, sub } = Route.useSearch();

  useEffect(() => {
    if (!isSuperadmin) navigate({ to: "/admin", replace: true });
  }, [isSuperadmin, navigate]);

  if (!isSuperadmin) return null;

  const setTab = (t: Tab) => navigate({ to: "/admin/manage", search: { tab: t } });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manage</h1>
      </div>

      <div className="mt-4 border-b">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2 text-sm font-medium capitalize transition ${
                tab === t
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
              {tab === t && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "users" && <UsersTab focusUserId={user ?? null} />}
        {tab === "courses" && <Placeholder name="Courses" />}
        {tab === "subscriptions" && (
          <SubscriptionsTab
            focusSubscriptionId={sub ?? null}
            onSelect={(id) =>
              navigate({
                to: "/admin/manage",
                search: id ? { tab: "subscriptions", sub: id } : { tab: "subscriptions" },
              })
            }
          />
        )}
        {tab === "invitations" && <Placeholder name="Invitations" />}
      </div>
    </div>
  );
}

function Placeholder({ name }: { name: string }) {
  return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
      {name} — coming in next prompt.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

function UsersTab({ focusUserId }: { focusUserId: string | null }) {
  const navigate = useNavigate();
  const listFn = useServerFn(listUsers);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | "superadmin" | "course_manager">("all");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [sort, setSort] = useState<"display_name" | "email" | "last_login_at">("email");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(focusUserId);

  useEffect(() => setSelectedUserId(focusUserId), [focusUserId]);

  const { data, isLoading } = useQuery({
    queryKey: ["manage-users", search, role, status, page, sort, sortDir],
    queryFn: () =>
      listFn({
        data: { search, role, status, page, pageSize: PAGE_SIZE, sort, sortDir },
      } as any),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (col: typeof sort) => {
    if (sort === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSort(col);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search email or display name…"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as any);
            setPage(1);
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All roles</option>
          <option value="superadmin">SuperAdmin</option>
          <option value="course_manager">Course Manager</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as any);
            setPage(1);
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" /> Invite user
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 w-10"></th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort("display_name")}>
                Name {sort === "display_name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort("email")}>
                Email {sort === "email" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Courses</th>
              <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort("last_login_at")}>
                Last login {sort === "last_login_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No users match the current filters.
                </td>
              </tr>
            )}
            {rows.map((u: any) => (
              <tr
                key={u.id}
                onClick={() =>
                  navigate({ to: "/admin/manage", search: { tab: "users", user: u.id } })
                }
                className="cursor-pointer border-t transition hover:bg-muted/30"
              >
                <td className="px-4 py-2">
                  <Initials text={u.display_name || u.email} />
                </td>
                <td className="px-4 py-2 font-medium">{u.display_name || "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2">
                  {(u.roles ?? []).map((r: string) => (
                    <span
                      key={r}
                      className={`mr-1 inline-block rounded-full px-2 py-0.5 text-xs ${
                        r === "superadmin"
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {r === "superadmin" ? "SuperAdmin" : "Course Manager"}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(u.courses ?? []).map((c: any) => (
                      <span
                        key={c.id}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {c.name}
                      </span>
                    ))}
                    {(u.courses ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2">
                  {u.suspended ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                      <ShieldAlert className="h-3 w-3" /> Suspended
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-700 dark:text-green-400">
                      <ShieldCheck className="h-3 w-3" /> Active
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              Page {page} of {lastPage} · {total} users
            </span>
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

      <UserDetailDrawer
        userId={selectedUserId}
        onClose={() =>
          navigate({ to: "/admin/manage", search: { tab: "users" } })
        }
      />
      {inviteOpen && <InviteUserDialog onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

function Initials({ text }: { text: string }) {
  const initials = useMemo(() => {
    const t = (text || "?").trim();
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return t.slice(0, 2).toUpperCase();
  }, [text]);
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// User detail drawer
// ---------------------------------------------------------------------------

function UserDetailDrawer({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const getFn = useServerFn(getUserDetail);
  const updateName = useServerFn(updateUserDisplayName);
  const changeRole = useServerFn(changeUserRole);
  const assignCourse = useServerFn(assignUserCourse);
  const unassignCourse = useServerFn(unassignUserCourse);
  const suspend = useServerFn(suspendUser);
  const reactivate = useServerFn(reactivateUser);
  const delFn = useServerFn(deleteUser);
  const resetFn = useServerFn(sendPasswordResetForUser);
  const listCoursesFn = useServerFn(listAllCourses);

  const enabled = !!userId;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["manage-user-detail", userId],
    enabled,
    queryFn: () => getFn({ data: { user_id: userId! } } as any),
  });
  const { data: allCourses = [] } = useQuery({
    queryKey: ["all-courses"],
    queryFn: () => listCoursesFn(),
    enabled,
  });

  const [name, setName] = useState("");
  const [pendingRole, setPendingRole] = useState<"superadmin" | "course_manager" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string>("");
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [addCourseId, setAddCourseId] = useState<string>("");

  useEffect(() => {
    setName(data?.profile?.display_name ?? "");
    setConfirmDelete("");
    setSuspendOpen(false);
    setSuspendReason("");
    setAddCourseId("");
    setPendingRole(null);
  }, [data?.profile?.id]);

  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["manage-users"] });
  };

  const onSaveName = async () => {
    if (!data) return;
    try {
      await updateName({ data: { user_id: data.profile.id, display_name: name } } as any);
      toast.success("Display name saved");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onChangeRole = async () => {
    if (!data || !pendingRole) return;
    try {
      await changeRole({ data: { user_id: data.profile.id, role: pendingRole } } as any);
      toast.success("Role updated");
      setPendingRole(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onAssignCourse = async () => {
    if (!data || !addCourseId) return;
    try {
      await assignCourse({ data: { user_id: data.profile.id, course_id: addCourseId } } as any);
      toast.success("Course assigned");
      setAddCourseId("");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onSuspend = async () => {
    if (!data) return;
    try {
      await suspend({ data: { user_id: data.profile.id, reason: suspendReason } } as any);
      toast.success("User suspended");
      setSuspendOpen(false);
      setSuspendReason("");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onReactivate = async () => {
    if (!data) return;
    try {
      await reactivate({ data: { user_id: data.profile.id } } as any);
      toast.success("User reactivated");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onDelete = async () => {
    if (!data) return;
    try {
      await delFn({
        data: { user_id: data.profile.id, confirm_email: confirmDelete },
      } as any);
      toast.success("User deleted");
      onClose();
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onSendReset = async () => {
    if (!data) return;
    try {
      const res = (await resetFn({ data: { user_id: data.profile.id } } as any)) as any;
      if (res.action_link) {
        await navigator.clipboard.writeText(res.action_link);
        toast.success("Password reset link copied to clipboard");
      } else {
        toast.success("Password reset email sent");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const assignedIds = new Set((data?.courses ?? []).map((c: any) => c.id));
  const assignable = (allCourses as any[]).filter((c) => !assignedIds.has(c.id));
  const activeSubsCount = (data?.subscriptions ?? []).filter((s: any) =>
    ["active", "trialing"].includes(s.status),
  ).length;

  return (
    <Sheet open={enabled} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>User detail</SheetTitle>
        </SheetHeader>
        {isLoading || !data ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="space-y-2">
              <div className="flex items-center gap-3">
                <Initials text={name || data.profile.email} />
                <div className="flex-1">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Display name"
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <button
                  onClick={onSaveName}
                  disabled={name === (data.profile.display_name ?? "")}
                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{data.profile.email}</p>
              {data.profile.suspended && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  Suspended {data.profile.suspended_at ? `on ${new Date(data.profile.suspended_at).toLocaleString()}` : ""}
                  {data.profile.suspension_reason ? ` — ${data.profile.suspension_reason}` : ""}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Role</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  Current:{" "}
                  <strong>
                    {data.roles.includes("superadmin")
                      ? "SuperAdmin"
                      : data.roles.includes("course_manager")
                      ? "Course Manager"
                      : "(none)"}
                  </strong>
                </span>
                <div className="ml-auto flex gap-1">
                  {!data.roles.includes("superadmin") && (
                    <button
                      onClick={() => setPendingRole("superadmin")}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                    >
                      Make SuperAdmin
                    </button>
                  )}
                  {!data.roles.includes("course_manager") && (
                    <button
                      onClick={() => setPendingRole("course_manager")}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                    >
                      Make Course Manager
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Course assignments</h3>
              <div className="rounded-md border">
                {data.courses.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">No assignments.</p>
                )}
                {data.courses.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between border-t px-3 py-2 first:border-t-0 text-sm"
                  >
                    <span>{c.name}</span>
                    <button
                      onClick={async () => {
                        try {
                          await unassignCourse({
                            data: { user_id: data.profile.id, course_id: c.id },
                          } as any);
                          toast.success("Removed");
                          refresh();
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={addCourseId}
                  onChange={(e) => setAddCourseId(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">Assign to course…</option>
                  {assignable.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onAssignCourse}
                  disabled={!addCourseId}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Active subscriptions</h3>
              <div className="rounded-md border">
                {data.subscriptions.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">None.</p>
                )}
                {data.subscriptions.map((s: any) => (
                  <div key={s.id} className="border-t px-3 py-2 first:border-t-0 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.course_name}</span>
                      <span className="text-xs text-muted-foreground">{s.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.plan_tier} · {s.board_count} board{s.board_count > 1 ? "s" : ""} · {s.billing_source}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2 border-t pt-4">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onSendReset}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <Mail className="h-3.5 w-3.5" /> Send password reset
                </button>
                {!data.profile.suspended ? (
                  <button
                    onClick={() => setSuspendOpen(true)}
                    disabled={data.profile.id === currentUser?.id}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> Suspend user
                  </button>
                ) : (
                  <button
                    onClick={onReactivate}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Reactivate
                  </button>
                )}
              </div>
              <div className="mt-4 rounded-md border border-destructive/40 p-3">
                <p className="text-xs font-medium text-destructive">Danger zone</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Type <code className="rounded bg-muted px-1">{data.profile.email}</code> to confirm deletion.
                  {activeSubsCount > 0 && " Blocked: user has active subscriptions."}
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                    placeholder={data.profile.email}
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={onDelete}
                    disabled={
                      confirmDelete.toLowerCase() !== data.profile.email.toLowerCase() ||
                      activeSubsCount > 0 ||
                      data.profile.id === currentUser?.id
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete user
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </SheetContent>

      <Dialog open={!!pendingRole} onOpenChange={(o) => !o && setPendingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Set this user's role to <strong>{pendingRole}</strong>. Existing role assignments will be replaced.
          </p>
          <DialogFooter>
            <button onClick={() => setPendingRole(null)} className="rounded-md border px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button
              onClick={onChangeRole}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend user</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            They will be signed out and unable to log in until reactivated.
          </p>
          <input
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <DialogFooter>
            <button onClick={() => setSuspendOpen(false)} className="rounded-md border px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button
              onClick={onSuspend}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              Suspend
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Invite user dialog
// ---------------------------------------------------------------------------

function InviteUserDialog({ onClose }: { onClose: () => void }) {
  const inviteFn = useServerFn(createInvitation);
  const checkFn = useServerFn(listInvitationsForEmail);
  const listCoursesFn = useServerFn(listAllCourses);
  const qc = useQueryClient();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"course_manager" | "superadmin">("course_manager");
  const [courseId, setCourseId] = useState<string>("");
  const [grantSub, setGrantSub] = useState(false);
  const [tier, setTier] = useState<"classic" | "interactive" | "estate" | "estate_interactive">(
    "interactive",
  );
  const [boardCount, setBoardCount] = useState(1);
  const [perpetual, setPerpetual] = useState(true);
  const [endsAt, setEndsAt] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
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
          grant_subscription_ends_at: grantSub && !perpetual && endsAt ? new Date(endsAt).toISOString() : null,
        },
      } as any)) as any;
      const url = `${window.location.origin}/accept-invite/${res.invitation.token}`;
      setInviteLink(url);
      qc.invalidateQueries({ queryKey: ["manage-users"] });
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invitation created — link copied to clipboard");
      } catch {
        toast.success("Invitation created");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-sm">Invitation created. Share this link:</p>
            <div className="flex gap-2">
              <input readOnly value={inviteLink} className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs" />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteLink);
                  toast.success("Copied");
                }}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
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
                      onChange={(e) => setTier(e.target.value as any)}
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
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={perpetual} onChange={(e) => setPerpetual(e.target.checked)} />
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
              <button type="button" onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button
                disabled={submitting}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {submitting ? "Sending…" : "Send invitation"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
