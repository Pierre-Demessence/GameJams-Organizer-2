import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { jamPhase } from "@/domain/jam-phase";
import { JamForm } from "@/app/jams/jam-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jam = await db.jam.findUnique({ where: { slug }, select: { name: true } });
  return { title: jam ? `Edit ${jam.name}` : "Edit Jam" };
}

export default async function EditJamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const { slug } = await params;
  const jam = await db.jam.findUnique({
    where: { slug },
    include: {
      roles: { where: { userId: session.user.id } },
      customFields: { orderBy: { sortOrder: "asc" } },
      criteria: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!jam) notFound();
  if (!hasPermission(jam.roles.map((r) => r.role), "edit_jam")) {
    notFound();
  }

  const phase = jamPhase(jam);
  const locked = phase === "RATING" || phase === "FINISHED";

  return (
    <JamForm
      mode="edit"
      jam={jam}
      phase={phase}
      criteria={jam.criteria.filter((c) => c.source === "RATED")}
      publishCriteria={jam.criteria}
      fields={jam.customFields}
      locked={locked}
    />
  );
}
