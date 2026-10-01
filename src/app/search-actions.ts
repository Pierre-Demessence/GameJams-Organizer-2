"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { searchJams } from "@/lib/search-queries";
import { SEARCH_MAX_QUERY } from "@/lib/search";

// Public: anyone may search listed jams. Throttled per IP because it runs as people type.
export async function searchJamsAction(query: unknown) {
  if (typeof query !== "string" || query.length > SEARCH_MAX_QUERY * 2) return { hits: [] };
  const ip = clientIp(await headers());
  if (!checkRateLimit(`search:${ip}`, 300).allowed) {
    return { hits: [], error: "Too many searches. Try again in a few minutes." };
  }
  return { hits: await searchJams(query) };
}
