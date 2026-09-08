"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { softDeleteJamAction } from "@/app/jams/actions";

export function DeleteJamButton({ jamId }: { jamId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError("");
    const result = await softDeleteJamAction(jamId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/jams");
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex items-center gap-2">
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting..." : "Confirm delete"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirming(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Delete jam
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
