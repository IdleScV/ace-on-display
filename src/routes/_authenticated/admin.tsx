import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { CourseProvider, useCourseCtx } from "@/lib/course-context";
import { Trophy, LogOut } from "lucide-react";
import { TutorChat } from "@/components/tutor-chat";

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => (
    <CourseProvider>
      <AdminLayout />
    </CourseProvider>
  ),
  head: () => ({ meta: [{ title: "Admin — Ace Board" }] }),
});

function AdminLayout() {
  const { user, isSuperadmin, isCourseManager, signOut } = useAuth();
  const { courses, activeCourse, setActiveCourseId } = useCourseCtx();
  const navigate = useNavigate();
  const loc = useLocation();

  const navItems = [
    { to: "/admin", label: "Dashboard", exact: true },
    ...(isSuperadmin ? [{ to: "/admin/courses", label: "Courses" }] : []),
    { to: "/admin/entries", label: "Entries" },
    { to: "/admin/import", label: "Import CSV" },
    { to: "/admin/settings", label: "Settings" },
    { to: "/admin/audit", label: "Audit" },
    ...(isSuperadmin ? [{ to: "/admin/health", label: "Display health" }] : []),
  ];

  const isActive = (to: string, exact?: boolean) =>
    exact ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-semibold">Ace Board</span>
            </Link>
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
            <span className="hidden text-sm text-muted-foreground md:inline">{user?.email}</span>
            <button
              onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
        <nav className="container mx-auto flex flex-wrap gap-1 px-6 pb-2 text-sm">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`rounded-md px-3 py-1.5 transition ${
                isActive(n.to, n.exact)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="container mx-auto px-6 py-8">
        <Outlet />
      </main>
      <TutorChat />
    </div>
  );
}
