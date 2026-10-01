import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { jamPhase } from "@/domain/jam-phase";
import { canCreateSubmission } from "@/domain/submission";
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
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/jams/${slug}/submissions/new`)}`);

  const jam = await db.jam.findUnique({
    where: { slug },
  });
  if (!jam) notFound();

  const [participant, existingMembership] = await Promise.all([
    db.jamParticipant.findUnique({
      where: { jamId_userId: { jamId: jam.id, userId: session.user.id } },
    }),
    db.submissionMember.findFirst({
      where: {
        userId: session.user.id,
        submission: { jamId: jam.id, deletedAt: null },
      },
    }),
  ]);
  if (existingMembership) {
    redirect(`/submissions/${existingMembership.submissionId}`);
  }

  const decision = canCreateSubmission({
    phase: jamPhase(jam),
    hasJoined: participant !== null,
    hasSubmission: false,
  });
  if (!decision.allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Cannot Submit</h1>
        <p className="mt-2 text-muted-foreground">{decision.reason}</p>
      </div>
    );
  }

  // Private questions are asked too; only their answers are hidden from the public.
  const customFields = await db.customField.findMany({
    where: { jamId: jam.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, description: true, type: true, required: true, isPrivate: true },
  });

  return (
    <SubmissionForm
      mode="create"
      jam={{ name: jam.name, slug: jam.slug, endDate: jam.endDate, submissionDetails: jam.submissionDetails }}
      customFields={customFields}
    />
  );
}
