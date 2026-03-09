import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SubmissionListProps {
  submissions: {
    id: string;
    title: string;
    coverUrl: string | null;
    disqualified: boolean;
    members: {
      isLeader: boolean;
      user: { username: string; displayName: string | null };
    }[];
  }[];
  jamSlug: string;
  status: string;
  hasJoined: boolean;
  userSubmissionId: string | null;
  hideSubmissionsBeforeEnd: boolean;
  isAdmin: boolean;
}

export function SubmissionList({
  submissions,
  jamSlug,
  status,
  hasJoined,
  userSubmissionId,
  hideSubmissionsBeforeEnd,
  isAdmin,
}: SubmissionListProps) {
  const canSeeSubmissions =
    !hideSubmissionsBeforeEnd ||
    status !== "ONGOING" ||
    isAdmin;

  const showSubmitButton =
    hasJoined &&
    !userSubmissionId &&
    status === "ONGOING";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          Submissions ({submissions.length})
        </CardTitle>
        <div className="flex gap-2">
          {showSubmitButton && (
            <Link
              href={`/jams/${jamSlug}/submissions/new`}
              className={buttonVariants({ size: "sm" })}
            >
              Submit Entry
            </Link>
          )}
          {userSubmissionId && (
            <Link
              href={`/submissions/${userSubmissionId}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Your Submission
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!canSeeSubmissions ? (
          <p className="text-sm text-muted-foreground italic">
            Submissions are hidden during the jam period.
          </p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <ul className="space-y-3">
            {submissions.map((sub) => {
              const leader = sub.members.find((m) => m.isLeader);
              return (
                <li key={sub.id}>
                  <Link
                    href={`/submissions/${sub.id}`}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-accent transition-colors"
                  >
                    <div>
                      <span className="font-medium">{sub.title}</span>
                      {sub.disqualified && (
                        <Badge variant="destructive" className="ml-2">
                          DQ
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground">
                        by{" "}
                        {leader
                          ? (leader.user.displayName ?? leader.user.username)
                          : "Unknown"}
                        {sub.members.length > 1 &&
                          ` +${sub.members.length - 1}`}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
