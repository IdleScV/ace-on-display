import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  lookupInvitation,
  acceptInvitationNewUser,
  acceptInvitationExistingUser,
} from "@/lib/invitations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, ShieldAlert, CheckCircle2, XCircle, Loader2, Trophy, Gift } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invitation/$token")({
  component: InvitationPage,
  head: () => ({
    meta: [
      { title: "Accept invitation — Ace Board" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const ROLE_LABEL: Record<string, string> = {
  course_manager: "Course Manager",
  superadmin: "SuperAdmin",
};
const TIER_LABEL: Record<string, string> = {
  classic: "Classic",
  interactive: "Interactive",
  estate: "Estate",
  estate_interactive: "Estate Interactive",
};

function titleCaseLocalPart(email: string) {
  const local = email.split("@")[0] ?? "";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Ace Board
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusPage({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <Shell>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800">
          {icon}
        </div>
        <h1 className="mb-2 text-xl font-semibold">{title}</h1>
        <p className="text-neutral-400">{body}</p>
        {cta && <div className="mt-6">{cta}</div>}
      </div>
    </Shell>
  );
}

function InvitationPage() {
  const { token } = Route.useParams();
  const lookup = useServerFn(lookupInvitation);
  const navigate = useNavigate();
  const { session, signOut } = useAuth();

  const { data: invitation, isLoading, error } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => lookup({ data: { token } }),
    retry: false,
  });

  if (isLoading) {
    return (
      <StatusPage
        icon={<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />}
        title="Loading invitation…"
        body="Hold on a moment."
      />
    );
  }

  if (error) {
    return (
      <StatusPage
        icon={<XCircle className="h-6 w-6 text-red-400" />}
        title="Couldn't load invitation"
        body="Please try again in a moment, or contact the person who invited you."
      />
    );
  }

  if (!invitation) {
    return (
      <StatusPage
        icon={<XCircle className="h-6 w-6 text-red-400" />}
        title="Invitation invalid"
        body="This invitation link is invalid. It may have been revoked or never existed."
      />
    );
  }

  if (invitation.status === "accepted") {
    return (
      <StatusPage
        icon={<CheckCircle2 className="h-6 w-6 text-emerald-400" />}
        title="Already accepted"
        body="This invitation has already been accepted. Sign in to access your account."
        cta={
          <Link to="/login">
            <Button>Sign in</Button>
          </Link>
        }
      />
    );
  }

  if (invitation.status === "revoked") {
    return (
      <StatusPage
        icon={<ShieldAlert className="h-6 w-6 text-amber-400" />}
        title="Invitation revoked"
        body="This invitation has been revoked. Contact the person who invited you."
      />
    );
  }

  if (invitation.status === "expired") {
    return (
      <StatusPage
        icon={<ShieldAlert className="h-6 w-6 text-amber-400" />}
        title="Invitation expired"
        body="This invitation has expired. Contact the person who invited you to send a new one."
      />
    );
  }

  // pending — show acceptance flow
  const currentEmail = session?.user?.email?.toLowerCase() ?? null;
  const inviteEmail = invitation.email.toLowerCase();
  const sameUser = currentEmail && currentEmail === inviteEmail;
  const differentUser = currentEmail && currentEmail !== inviteEmail;

  const redirectAfter = (role: string) => {
    if (role === "superadmin") navigate({ to: "/admin/manage" });
    else navigate({ to: "/admin/entries" });
  };

  if (differentUser) {
    return (
      <Shell>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-400" />
            <div className="text-sm text-amber-100">
              You're signed in as <strong>{currentEmail}</strong>. Accepting this invitation
              will sign you out and create a new account for{" "}
              <strong>{invitation.email}</strong>.
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                await signOut();
                window.location.reload();
              }}
            >
              Sign out and continue
            </Button>
            <Link to="/admin">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (sameUser) {
    return (
      <SameUserAccept
        invitation={invitation}
        token={token}
        onSuccess={(role) => redirectAfter(role)}
      />
    );
  }

  return (
    <NewUserAccept
      invitation={invitation}
      token={token}
      onSuccess={(role) => redirectAfter(role)}
    />
  );
}

type Inv = NonNullable<Awaited<ReturnType<typeof lookupInvitation>>>;

function InvitationHeader({ invitation }: { invitation: Inv }) {
  const target = invitation.course_name ?? "Ace Board";
  const tierLabel = invitation.grant_subscription_tier
    ? TIER_LABEL[invitation.grant_subscription_tier] ?? invitation.grant_subscription_tier
    : null;
  return (
    <div className="mb-6 space-y-3">
      <h1 className="text-2xl font-semibold">You've been invited to {target}</h1>
      <p className="text-neutral-300">
        <strong>{invitation.inviter_display_name ?? "An administrator"}</strong> invited you to
        join as a <strong>{ROLE_LABEL[invitation.role] ?? invitation.role}</strong>.
      </p>
      {tierLabel && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          <Gift className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            You'll also receive a <strong>{tierLabel}</strong> subscription for{" "}
            <strong>{invitation.course_name}</strong>
            {invitation.grant_subscription_ends_at
              ? `, valid until ${new Date(invitation.grant_subscription_ends_at).toLocaleDateString()}`
              : ""}{" "}
            — a free gift.
          </span>
        </div>
      )}
    </div>
  );
}

function NewUserAccept({
  invitation,
  token,
  onSuccess,
}: {
  invitation: Inv;
  token: string;
  onSuccess: (role: string) => void;
}) {
  const acceptFn = useServerFn(acceptInvitationNewUser);
  const defaultName = useMemo(() => titleCaseLocalPart(invitation.email), [invitation.email]);
  const [displayName, setDisplayName] = useState(defaultName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error("Password must be 12+ chars with letters and numbers");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (!agree) {
      toast.error("Please agree to the terms");
      return;
    }
    setSubmitting(true);
    try {
      const res = await acceptFn({
        data: { token, displayName: displayName.trim(), password },
      });
      // Sign the new user in
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: res.email,
        password,
      });
      if (signErr) throw signErr;
      toast.success("Welcome to Ace Board!");
      onSuccess(res.role);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept invitation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <InvitationHeader invitation={invitation} />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input value={invitation.email} disabled className="mt-1" />
        </div>
        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={120}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-neutral-500">
            At least 12 characters, including letters and numbers.
          </p>
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={12}
            className="mt-1"
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="agree"
            checked={agree}
            onCheckedChange={(v) => setAgree(v === true)}
          />
          <label htmlFor="agree" className="text-sm text-neutral-300">
            I agree to the{" "}
            <Link to="/terms" className="underline">
              terms
            </Link>
            .
          </label>
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" />
          )}
          Accept invitation & create account
        </Button>
      </form>
    </Shell>
  );
}

function SameUserAccept({
  invitation,
  token,
  onSuccess,
}: {
  invitation: Inv;
  token: string;
  onSuccess: (role: string) => void;
}) {
  const acceptFn = useServerFn(acceptInvitationExistingUser);
  const [submitting, setSubmitting] = useState(false);

  const onAccept = async () => {
    setSubmitting(true);
    try {
      const res = await acceptFn({ data: { token } });
      toast.success("Invitation accepted");
      onSuccess(res.role);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept invitation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <InvitationHeader invitation={invitation} />
      <p className="mb-4 text-sm text-neutral-400">
        You're signed in as <strong>{invitation.email}</strong>. No new account needed.
      </p>
      <Button onClick={onAccept} disabled={submitting} className="w-full">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Accept invitation as {invitation.email}
      </Button>
    </Shell>
  );
}
