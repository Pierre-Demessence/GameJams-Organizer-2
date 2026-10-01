// Deployments sit behind exactly one Traefik hop, which appends the address it saw to
// X-Forwarded-For. Earlier entries come from the client and can be forged, so only the last
// one is trusted.
export function clientIp(h: { get(name: string): string | null }): string {
  const forwarded = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? h.get("x-real-ip")?.trim() ?? "unknown";
}
