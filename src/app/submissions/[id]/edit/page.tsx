import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkJamPermission } from "@/lib/permissions";
import { jamPhase } from "@/domain/jam-phase";
import { canEditSubmission } from "@/domain/submission";
import { SubmissionForm } from "@/app/jams/[slug]/submissions/new/submission-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await db.submission.findUnique({
    where: { id },
    select: { title: true, jam: { select: { deletedAt: true } } },
  });
  if (!submission || submission.jam.deletedAt)
    return { title: "Submission Not Found" };
  return { title: `Edit ${submission.title}` };
}

export default async function EditSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const submission = await db.submission.findUnique({
    where: { id },
    include: {
      jam: {
        select: {
          id: true,
          slug: true,
          name: true,
          publishedAt: true,
          startDate: true,
          endDate: true,
          ratingEnd: true,
          ranked: true,
          deletedAt: true,
        },
      },
      members: true,
      fieldValues: { select: { fieldId: true, value: true } },
    },
  });
  if (!submission || submission.jam.deletedAt) notFound();

  const isMember = submission.members.some(
    (m) => m.userId === session.user!.id
  );
  const canModerate = await checkJamPermission(
    submission.jamId,
    session.user.id,
    "edit_submission"
  );
  if (!isMember && !canModerate) notFound();

  const decision = canEditSubmission({
    phase: jamPhase(submission.jam),
    isMember,
    canEditAny: canModerate,
  });
  if (!decision.allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Editing Locked</h1>
        <p className="mt-2 text-muted-foreground">{decision.reason}</p>
      </div>
    );
  }

  const customFields = await db.customField.findMany({
    where: { jamId: submission.jamId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, description: true, type: true, required: true },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">
        Edit: {submission.title}
      </h1>
      <SubmissionForm
        jamSlug={submission.jam.slug}
        customFields={customFields}
        mode="edit"
        submission={{
          id: submission.id,
          title: submission.title,
          description: submission.description,
          coverUrl: submission.coverUrl,
          itchUrl: submission.itchUrl,
          supportedPlatforms: submission.supportedPlatforms,
          screenshots: submission.screenshots,
          videoUrl: submission.videoUrl,
          fieldValues: submission.fieldValues,
        }}
      />
    </div>
  );
}
