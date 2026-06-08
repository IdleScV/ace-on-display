import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/accept-invite/$token")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/invitation/$token", params: { token: params.token } });
  },
});
