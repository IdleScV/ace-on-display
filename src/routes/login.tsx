import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — Ace Board" }] }),
});

function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "magic" | "forgot">("signin");
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("aceboard-remember-me");
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    if (session) navigate({ to: "/admin" });
  }, [session, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        localStorage.setItem("aceboard-remember-me", rememberMe ? "true" : "false");
        sessionStorage.setItem("aceboard-session-active", "true");
        toast.success("Welcome back");
        navigate({ to: "/admin" });
      } else if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Check your email for a sign-in link");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent");
        setMode("signin");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-semibold">Ace Board</span>
        </Link>
        <h1 className="text-2xl font-semibold">
          {mode === "signin" ? "Sign in" : mode === "magic" ? "Magic link" : "Reset password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Access your course's CMS"
            : mode === "magic"
            ? "We'll email you a one-click sign-in link"
            : "We'll email you a reset link"}
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {mode === "signin" && (
            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          {mode === "signin" && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm text-muted-foreground">Remember me</span>
            </label>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting
              ? "Working…"
              : mode === "signin"
              ? "Sign in"
              : mode === "magic"
              ? "Send magic link"
              : "Send reset link"}
          </button>
        </form>
        <div className="mt-4 flex flex-col gap-1 text-center text-xs text-muted-foreground">
          {mode !== "magic" && (
            <button onClick={() => setMode("magic")} className="hover:text-foreground">
              Sign in with magic link
            </button>
          )}
          {mode !== "signin" && (
            <button onClick={() => setMode("signin")} className="hover:text-foreground">
              Sign in with password
            </button>
          )}
          {mode !== "forgot" && (
            <button onClick={() => setMode("forgot")} className="hover:text-foreground">
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
