import { allow, deny, type Decision } from "@/domain/decision";

// Spec §10: staff powers need a staff role and a browser that has passed a TOTP check.
// Reasons are ordered by what the member must do next.
export function staffAccess(input: {
  hasRole: boolean;
  enrolled: boolean;
  verified: boolean;
}): Decision {
  if (!input.hasRole) return deny("You do not have staff access");
  if (!input.enrolled) return deny("Set up two-factor authentication");
  if (!input.verified) return deny("Enter your two-factor code");
  return allow;
}
