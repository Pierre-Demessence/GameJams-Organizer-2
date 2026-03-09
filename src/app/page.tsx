import Link from "next/link";
import { db } from "@/lib/db";
import { computeJamStatus } from "@/lib/jam-status";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const statusColors: Record<string, string> = {
  UPCOMING: "bg-blue-500",
  ONGOING: "bg-green-500",
  RATING: "bg-yellow-500",
  FINISHED: "bg-purple-500",
};

export default async function HomePage() {
  const now = new Date();

  const [ongoingJams, upcomingJams, recentlyFinished] = await Promise.all([
    db.jam.findMany({
      where: {
        visibility: "PUBLISHED",
        OR: [
          { startDate: { lte: now }, endDate: { gt: now } },
          { ranked: true, endDate: { lte: now }, ratingEnd: { gt: now } },
        ],
      },
      include: { _count: { select: { participants: true, submissions: true } } },
      orderBy: { endDate: "asc" },
      take: 6,
    }),
    db.jam.findMany({
      where: {
        visibility: "PUBLISHED",
        startDate: { gt: now },
      },
      include: { _count: { select: { participants: true, submissions: true } } },
      orderBy: { startDate: "asc" },
      take: 6,
    }),
    db.jam.findMany({
      where: {
        visibility: "PUBLISHED",
        OR: [
          { ratingEnd: { lte: now } },
          { endDate: { lte: now }, ranked: false },
        ],
      },
      include: { _count: { select: { participants: true, submissions: true } } },
      orderBy: { endDate: "desc" },
      take: 6,
    }),
  ]);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          🎮 GameJam Organizer
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Create, join, and rate game jams. Free and open source.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/jams" className={buttonVariants({ size: "lg" })}>
            Browse Jams
          </Link>
          <Link
            href="/jams/new"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Create a Jam
          </Link>
        </div>
      </div>

      <div className="mt-16 space-y-12">
        {ongoingJams.length > 0 && (
          <JamSection title="🔥 Happening Now" jams={ongoingJams} />
        )}
        {upcomingJams.length > 0 && (
          <JamSection title="📅 Upcoming" jams={upcomingJams} />
        )}
        {recentlyFinished.length > 0 && (
          <JamSection title="🏆 Recently Finished" jams={recentlyFinished} />
        )}
      </div>
    </div>
  );
}

function JamSection({
  title,
  jams,
}: {
  title: string;
  jams: {
    id: string;
    slug: string;
    name: string;
    shortDesc: string;
    startDate: Date | null;
    endDate: Date | null;
    ratingEnd: Date | null;
    ranked: boolean;
    tags: string[];
    _count: { participants: number; submissions: number };
  }[];
}) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jams.map((jam) => {
          const status = computeJamStatus(jam);
          return (
            <Link key={jam.id} href={`/jams/${jam.slug}`}>
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{jam.name}</CardTitle>
                    <Badge className={statusColors[status] ?? "bg-gray-500"}>
                      {status}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {jam.shortDesc}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{jam._count.participants} participants</span>
                    <span>{jam._count.submissions} submissions</span>
                  </div>
                  {jam.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {jam.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
