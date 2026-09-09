import type { Session } from "next-auth";

// Mutable holder the mocked `auth()` reads from. Tests set the acting user via
// actingAs()/signOut(); setup.ts resets it before each test.
export const currentSession: { value: Session | null } = { value: null };

export function actingAs(userId: string): void {
  currentSession.value = { user: { id: userId } } as Session;
}

export function signOut(): void {
  currentSession.value = null;
}
