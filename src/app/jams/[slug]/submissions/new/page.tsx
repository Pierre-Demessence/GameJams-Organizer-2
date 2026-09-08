import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeJamStatus } from "@/lib/jam-status";
import { SubmissionForm } from "./submission-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jam = await db.jam.findUnique({
    where: { slug },
    select: { name: true },
  });
  if (!jam) return { title: "Jam Not Found" };
  return { title: `Submit to ${jam.name}` };
}

export default async function NewSubmissionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const jam = await db.jam.findUnique({
    where: { slug },
    include: {
      customFields: {
        where: { isPrivate: false },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!jam) notFound();

  const status = computeJamStatus(jam);
  if (status !== "ONGOING") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Submissions Closed</h1>
        <p className="mt-2 text-muted-foreground">
          Submissions are only accepted during the ongoing period.
        </p>
      </div>
    );
  }

  const participant = await db.jamParticipant.findUnique({
    where: { jamId_userId: { jamId: jam.id, userId: session.user.id } },
  });
  if (!participant) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Join First</h1>
        <p className="mt-2 text-muted-foreground">
          You need to join this jam before submitting.
        </p>
      </div>
    );
  }

  const existingMembership = await db.submissionMember.findFirst({
    where: {
      userId: session.user.id,
      submission: { jamId: jam.id, deletedAt: null },
    },
  });
  if (existingMembership) {
    redirect(`/submissions/${existingMembership.submissionId}`);
  }

  // Include all custom fields (including private) for submission form
  const allCustomFields = await db.customField.findMany({
    where: { jamId: jam.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, description: true, type: true, required: true },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Submit to {jam.name}</h1>
      <SubmissionForm
        jamSlug={slug}
        customFields={allCustomFields}
        mode="create"
      />
    </div>
  );
}
