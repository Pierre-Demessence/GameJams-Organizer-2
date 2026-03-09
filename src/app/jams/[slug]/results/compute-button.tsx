"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { computeResultsAction } from "./actions";

export function ComputeResultsButton({ jamId }: { jamId: string }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCompute() {
    setError("");
    startTransition(async () => {
      const result = await computeResultsAction(jamId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <Button onClick={handleCompute} disabled={isPending} variant="outline" size="sm">
        {isPending ? "Computing..." : "Recompute Results"}
      </Button>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
