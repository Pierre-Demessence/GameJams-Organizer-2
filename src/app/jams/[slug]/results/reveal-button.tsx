"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revealResultsAction } from "./actions";

export function RevealResultsButton({ jamId }: { jamId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleReveal() {
    if (!window.confirm("Reveal the results to everyone? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await revealResultsAction(jamId);
      if (result.error) toast.error(result.error);
      else toast.success("Results revealed");
    });
  }

  return (
    <Button onClick={handleReveal} disabled={isPending} className="h-11 px-3.5 font-semibold md:h-9">
      {isPending ? "Revealing…" : "Reveal results"}
    </Button>
  );
}
