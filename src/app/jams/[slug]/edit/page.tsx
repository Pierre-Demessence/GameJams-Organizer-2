import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeJamStatus } from "@/lib/jam-status";
import { JamForm } from "@/app/jams/jam-form";
import { CustomFieldsManager } from "./custom-fields-manager";
import { CriteriaManager } from "./criteria-manager";

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
  if (!jam.roles.length || jam.roles[0].role !== "ADMIN") {
    notFound();
  }

  const status = computeJamStatus(jam);
  const fieldsLocked = status === "RATING" || status === "FINISHED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Edit {jam.name}</h1>
      <JamForm mode="edit" jam={jam} />
      <div className="mt-6">
        <CustomFieldsManager
          jamId={jam.id}
          fields={jam.customFields}
          locked={fieldsLocked}
        />
      </div>
      {jam.ranked && (
        <div className="mt-6">
          <CriteriaManager
            jamId={jam.id}
            criteria={jam.criteria}
            locked={fieldsLocked}
          />
        </div>
      )}
    </div>
  );
}
