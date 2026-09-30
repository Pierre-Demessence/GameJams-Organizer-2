"use client";

import { useRouter } from "next/navigation";
import { jamListHref, type JamListParams } from "@/lib/jam-list-params";

const SELECT =
  "min-h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-10 md:min-h-10";

export function JamFilters({ params }: { params: JamListParams }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Format
        <select
          className={SELECT}
          value={params.format}
          onChange={(e) =>
            router.push(jamListHref(params, { format: e.target.value as JamListParams["format"] }))
          }
        >
          <option value="any">Any</option>
          <option value="ranked">Ranked</option>
          <option value="showcase">Showcase</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Sort
        <select
          className={SELECT}
          value={params.sort}
          onChange={(e) =>
            router.push(jamListHref(params, { sort: e.target.value as JamListParams["sort"] }))
          }
        >
          <option value="relevant">Relevant first</option>
          <option value="newest">Newest</option>
          <option value="joined">Most joined</option>
        </select>
      </label>
    </div>
  );
}
