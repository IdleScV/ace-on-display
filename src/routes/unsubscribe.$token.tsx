import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/unsubscribe/$token")({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Unsubscribe — Ace Board" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function UnsubscribePage() {
  const { token } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["unsub", token],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("unsubscribe_by_token", { _token: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { course_name: string; already_unsubscribed: boolean } | null;
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-12 text-white">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800">
          {isLoading ? (
            <Mail className="h-6 w-6 text-neutral-400" />
          ) : error ? (
            <XCircle className="h-6 w-6 text-red-400" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          )}
        </div>
        {isLoading ? (
          <p className="text-sm text-neutral-400">Processing…</p>
        ) : error ? (
          <>
            <h1 className="text-lg font-semibold">Invalid unsubscribe link</h1>
            <p className="mt-2 text-sm text-neutral-400">
              This link is no longer valid. If you keep getting emails, contact the
              course directly.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-neutral-400">
              You've been unsubscribed from{" "}
              <span className="font-medium text-white">{data?.course_name}</span>{" "}
              updates.
            </p>
            {data?.already_unsubscribed && (
              <p className="mt-2 text-xs text-neutral-500">
                (You were already unsubscribed.)
              </p>
            )}
          </>
        )}
        <Link
          to="/"
          className="mt-6 inline-block text-xs uppercase tracking-widest text-amber-400 hover:underline"
        >
          Powered by Ace Board
        </Link>
      </div>
    </div>
  );
}
