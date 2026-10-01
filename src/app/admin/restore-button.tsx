"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { restoreJamAction, restoreSubmissionAction } from "./actions";

export function RestoreButton({ kind, id, label }: { kind: "jam" | "submission"; id: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={`Restore ${label}`}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = kind === "jam" ? await restoreJamAction(id) : await restoreSubmissionAction(id);
          if (result.error) toast.error(result.error);
          else toast.success(`Restored ${label}`);
          router.refresh();
        })
      }
      className="h-11 px-3 text-[13px] md:h-7.5"
    >
      {isPending ? "Restoring…" : "Restore"}
    </Button>
  );
}
