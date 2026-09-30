"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revealResultsAction } from "./actions";

export function RevealResultsButton({ jamId }: { jamId: string }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleReveal() {
    setError("");
    startTransition(async () => {
      const result = await revealResultsAction(jamId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <Button onClick={handleReveal} disabled={isPending} size="sm">
        {isPending ? "Revealing..." : "Reveal Results"}
      </Button>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
