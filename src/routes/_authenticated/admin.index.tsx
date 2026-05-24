import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useCourseCtx } from "@/lib/course-context";
import { useServerFn } from "@tanstack/react-start";
import { claimSuperadminIfNone } from "@/lib/courses.functions";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { isSuperadmin, roles, refresh } = useAuth();
  const { activeCourse, loading } = useCourseCtx();
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

  if (!hasAnyRole) {
    return (
      <div className="rounded-xl border bg-card p-6">
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
    );
  }

  return (
    <div>
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
