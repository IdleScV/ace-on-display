import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPublicEntryDetail } from "@/lib/public.functions";
import { getRequestOrigin } from "@/lib/origin.functions";
import { EntryDetailView } from "@/components/EntryDetailView";
import { z } from "zod";

const searchSchema = z.object({
  style: z.enum(["walnut", "mahogany", "slate", "modern"]).optional(),
});

const detailOptions = (slug: string, entryId: string) =>
  queryOptions({
    queryKey: ["public-entry-detail", slug, entryId],
    queryFn: async () => {
      const [data, origin] = await Promise.all([
        getPublicEntryDetail({ data: { slug, entryId } } as any),
        getRequestOrigin().catch(() => "https://gcboard.bonetooth.org"),
      ]);
      return { data, origin };
    },
  });

export const Route = createFileRoute("/$slug/entry/$entryId")({
  validateSearch: searchSchema,
  loader: async ({ params, context }) => {
    const res = await context.queryClient.ensureQueryData(
      detailOptions(params.slug, params.entryId),
    );
    if (!res.data) throw notFound();
    return res;
  },
  head: ({ params, loaderData }) => {
    if (!loaderData?.data) {
      return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    }
    const { course, entry } = loaderData.data;
    const origin = loaderData.origin;
    const url = `${origin}/${params.slug}/entry/${params.entryId}`;
    const dateLabel = new Date(entry.date_achieved + "T12:00:00").toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const descParts = [dateLabel];
    if (entry.yardage != null) descParts.push(`${entry.yardage} yards`);
    if (entry.club) descParts.push(entry.club);
    const description = descParts.join(" • ");
    const title = `${entry.golfer_name} — Hole-in-One at ${course.name}, Hole ${entry.hole_number}`;
    const heroFromPhotos = entry.photos?.[0]?.url;
    const heroRaw = heroFromPhotos || entry.photo_url || course.logo_url || null;
    const ogImage = heroRaw
      ? (heroRaw.startsWith("http") ? heroRaw : `${origin}${heroRaw.startsWith("/") ? "" : "/"}${heroRaw}`)
      : null;

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "article" },
      { property: "og:site_name", content: course.name },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (ogImage) {
      meta.push({ property: "og:image", content: ogImage });
      meta.push({ name: "twitter:image", content: ogImage });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-center text-white">
      <div>
        <h1 className="text-2xl font-semibold">Entry not found</h1>
        <p className="mt-2 text-sm text-neutral-400">This ace isn’t available.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-amber-400 hover:underline">Go home</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-center text-white">
      <div>
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-neutral-400">{error.message}</p>
      </div>
    </div>
  ),
  component: EntryPage,
});

function EntryPage() {
  const { slug, entryId } = Route.useParams();
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(detailOptions(slug, entryId));
  if (!data.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        Not found
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-neutral-950">
      <EntryDetailView course={data.data.course} entry={data.data.entry} style={search.style ?? "walnut"} />
    </div>
  );
}
