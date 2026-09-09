import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeJamStatus } from "@/lib/jam-status";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JamStatus } from "@/generated/prisma/client";

export const metadata = {
  title: "Jams",
  description: "Browse game jams",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  UPCOMING: "bg-blue-500",
  ONGOING: "bg-green-500",
  RATING: "bg-yellow-500",
  FINISHED: "bg-purple-500",
};

const STATUS_OPTIONS: JamStatus[] = [
  "UPCOMING",
  "ONGOING",
  "RATING",
  "FINISHED",
];

export default async function JamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const query = params.q?.trim() ?? "";
  const statusFilter = params.status ?? "";
  const tagFilter = params.tag?.trim() ?? "";

  const jams = await db.jam.findMany({
    where: {
      deletedAt: null,
      visibility: "PUBLIC",
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { shortDesc: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(tagFilter ? { tags: { has: tagFilter } } : {}),
    },
    include: {
      _count: { select: { participants: true, submissions: true } },
      createdBy: { select: { username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Compute status client-side and filter
  const jamsWithStatus = jams
    .map((jam) => ({
      ...jam,
      computedStatus: computeJamStatus(jam),
    }))
    .filter((jam) => jam.computedStatus !== "DRAFT")
    .filter((jam) => !statusFilter || jam.computedStatus === statusFilter);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Game Jams</h1>
        {session?.user && (
          <Link
            href="/jams/new"
            className={buttonVariants({ variant: "default" })}
          >
            Create Jam
          </Link>
        )}
      </div>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-3" action="/jams" method="GET">
        <Input
          name="q"
          placeholder="Search jams..."
          defaultValue={query}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          <Link
            href={buildFilterUrl("", tagFilter, query)}
            className={buttonVariants({
              variant: statusFilter === "" ? "default" : "outline",
              size: "sm",
            })}
          >
            All
          </Link>
          {STATUS_OPTIONS.map((s) => (
            <Link
              key={s}
              href={buildFilterUrl(s, tagFilter, query)}
              className={buttonVariants({
                variant: statusFilter === s ? "default" : "outline",
                size: "sm",
              })}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
        {tagFilter && (
          <div className="flex items-center gap-1">
            <Badge variant="secondary">{tagFilter}</Badge>
            <Link
              href={buildFilterUrl(statusFilter, "", query)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </Link>
          </div>
        )}
      </form>

      {/* Results */}
      {jamsWithStatus.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No jams found.{" "}
          {session?.user && (
            <Link href="/jams/new" className="text-primary hover:underline">
              Create one!
            </Link>
          )}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jamsWithStatus.map((jam) => (
            <Link key={jam.id} href={`/jams/${jam.slug}`} prefetch={false}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="line-clamp-1">{jam.name}</CardTitle>
                    <Badge className={statusColors[jam.computedStatus]}>
                      {jam.computedStatus}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {jam.shortDesc}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      by{" "}
                      {jam.createdBy.displayName ?? jam.createdBy.username}
                    </span>
                    <span>
                      {jam._count.participants} participant
                      {jam._count.participants !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {jam.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {jam.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {jam.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{jam.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function buildFilterUrl(status: string, tag: string, q: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (tag) params.set("tag", tag);
  const qs = params.toString();
  return qs ? `/jams?${qs}` : "/jams";
}
