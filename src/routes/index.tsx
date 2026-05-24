import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, MonitorPlay, Settings } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Ace Board — Celebrate every hole-in-one" },
      { name: "description", content: "A clubhouse display, public record, and CMS for hole-in-one achievements at your golf course." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">Ace Board</span>
        </div>
        <Link
          to="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in
        </Link>
      </header>

      <main className="container mx-auto px-6 pb-24 pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground md:text-6xl">
            Every ace, on the wall.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Ace Board runs the clubhouse display, the public hole-in-one page,
            and the admin tools that keep them in sync — across every course
            you manage.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open the CMS
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-6 md:grid-cols-3">
          <Feature icon={<MonitorPlay className="h-5 w-5" />} title="Kiosk display">
            Fullscreen carousel for clubhouse TVs. Caches data, auto-refreshes,
            phones home every minute.
          </Feature>
          <Feature icon={<Trophy className="h-5 w-5" />} title="Public record">
            A branded, searchable page for your members and guests.
          </Feature>
          <Feature icon={<Settings className="h-5 w-5" />} title="One CMS, many courses">
            Course managers see only their course. SuperAdmins see everything.
          </Feature>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
