import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { Trophy, LogOut, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { CourseProvider, useCourseCtx } from "@/lib/course-context";
import { TutorChat } from "@/components/tutor-chat";
import { AdminChat } from "@/components/admin-chat";
import { RoleSimulator } from "@/components/role-simulator";

/**
 * Shared chrome used by both /admin/* routes and the top-level /how-to route.
 * Provides the CourseProvider, header, and main nav.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <CourseProvider>
      <Shell>{children}</Shell>
    </CourseProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { user, isSuperadmin, isCourseManager, signOut } = useAuth();
  const { courses, activeCourse, setActiveCourseId } = useCourseCtx();
  const navigate = useNavigate();
  const loc = useLocation();

  const navItems: { to: string; label: string; exact?: boolean; icon?: typeof BookOpen }[] = [
    { to: "/admin", label: "Dashboard", exact: true },
    ...(isSuperadmin ? [{ to: "/admin/courses", label: "Courses" }] : []),
    ...(isSuperadmin ? [{ to: "/admin/manage", label: "Manage" }] : []),
    { to: "/admin/entries", label: "Entries" },
    { to: "/admin/import", label: "Import CSV" },
    { to: "/admin/settings", label: "Settings" },
    { to: "/admin/subscribers", label: "Subscribers" },
    { to: "/admin/audit", label: "Audit" },
    ...(isSuperadmin ? [{ to: "/admin/health", label: "Display health" }] : []),
    { to: "/how-to", label: "How-To", icon: BookOpen },
  ];

  const isActive = (to: string, exact?: boolean) =>
    exact ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3">
          <div className="flex items-center gap-3 whitespace-nowrap">
            <Link to="/admin" className="flex items-baseline gap-2">
              <Trophy className="h-5 w-5 translate-y-0.5 text-primary" />
              <span className="font-semibold">Ace Board</span>
              <span className="text-xs text-muted-foreground">by Enshrined</span>
            </Link>
            {isSuperadmin && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">SuperAdmin</span>
            )}
            {isCourseManager && !isSuperadmin && (
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">Course Manager</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <RoleSimulator />
            {courses.length > 0 && (
              <select
                value={activeCourse?.id ?? ""}
                onChange={(e) => setActiveCourseId(e.target.value)}
                className="max-w-[200px] truncate rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <span className="hidden max-w-[200px] truncate text-sm text-muted-foreground md:inline">{user?.email}</span>
            <button
              onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
        <nav className="container mx-auto flex flex-wrap gap-1 px-6 pb-2 text-sm">
          {navItems.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                  isActive(n.to, n.exact)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="container mx-auto px-6 py-8">{children}</main>
      <TutorChat />
      <AdminChat />
    </div>
  );
}
