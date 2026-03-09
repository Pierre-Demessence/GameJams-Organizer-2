"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { joinJamAction, publishJamAction } from "@/app/jams/actions";
import { useRouter } from "next/navigation";

export function JoinJamButton({ jamId }: { jamId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleJoin() {
    setLoading(true);
    setError("");
    const result = await joinJamAction(jamId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      <Button onClick={handleJoin} disabled={loading}>
        {loading ? "Joining..." : "Join Jam"}
      </Button>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function PublishJamButton({ jamId }: { jamId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handlePublish() {
    setLoading(true);
    setError("");
    const result = await publishJamAction(jamId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      <Button onClick={handlePublish} disabled={loading} variant="default">
        {loading ? "Publishing..." : "Publish Jam"}
      </Button>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
