import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { CourseProvider, useCourseCtx } from "@/lib/course-context";
import { useServerFn } from "@tanstack/react-start";
import { claimSuperadminIfNone } from "@/lib/courses.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Trophy, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => (
    <CourseProvider>
      <AdminHome />
    </CourseProvider>
  ),
  head: () => ({ meta: [{ title: "Admin — Ace Board" }] }),
});

function AdminHome() {
  const { user, isSuperadmin, isCourseManager, roles, signOut, refresh } = useAuth();
  const { courses, activeCourse, setActiveCourseId, loading } = useCourseCtx();
  const navigate = useNavigate();
  const claim = useServerFn(claimSuperadminIfNone);
  const [claiming, setClaiming] = useState(false);

  const hasAnyRole = roles.length > 0;

  const onClaim = async () => {
    setClaiming(true);
    try {
      const res = await claim();
      if (res.claimed) {
        toast.success("You are now the SuperAdmin");
        await refresh();
      } else {
        toast.info("A SuperAdmin already exists");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-semibold">Ace Board</span>
            {isSuperadmin && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">SuperAdmin</span>}
            {isCourseManager && !isSuperadmin && <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">Course Manager</span>}
          </div>
          <div className="flex items-center gap-3">
            {courses.length > 0 && (
              <select
                value={activeCourse?.id ?? ""}
                onChange={(e) => setActiveCourseId(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <button
              onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        {!hasAnyRole && (
          <div className="mb-8 rounded-xl border bg-card p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Bootstrap your platform</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  No SuperAdmin exists yet. Claim the first SuperAdmin role to set up courses and managers.
                </p>
                <button
                  onClick={onClaim}
                  disabled={claiming}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {claiming ? "Claiming…" : "Claim SuperAdmin"}
                </button>
              </div>
            </div>
          </div>
        )}

        {hasAnyRole && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCourse ? `Managing ${activeCourse.name}` : loading ? "Loading courses…" : "No courses assigned yet."}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isSuperadmin && (
                <NavCard to="/admin/courses" title="Courses" desc="Create courses, assign managers" />
              )}
              {activeCourse && (
                <>
                  <NavCard to="/admin/entries" title="Entries" desc="Manage hole-in-one records" />
                  <NavCard to="/admin/settings" title="Course settings" desc="Branding, public page, display sort" />
                  <NavCard to="/admin/audit" title="Audit log" desc="Track every change" />
                  <a
                    href={`/${activeCourse.slug}/display`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border bg-card p-5 hover:bg-accent"
                  >
                    <div className="font-medium">Open kiosk display</div>
                    <div className="mt-1 text-xs text-muted-foreground">/{activeCourse.slug}/display</div>
                  </a>
                  <a
                    href={`/${activeCourse.slug}/hole-in-ones`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border bg-card p-5 hover:bg-accent"
                  >
                    <div className="font-medium">View public page</div>
                    <div className="mt-1 text-xs text-muted-foreground">/{activeCourse.slug}/hole-in-ones</div>
                  </a>
                </>
              )}
              {isSuperadmin && <NavCard to="/admin/health" title="Display health" desc="Monitor all kiosk displays" />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function NavCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="rounded-xl border bg-card p-5 hover:bg-accent">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </Link>
  );
}
