import { describe, it, expect } from "vitest";
import { jamRoleLabel, platformLabel, ratingEligibilityLabel } from "@/lib/jam-labels";

describe("jam labels", () => {
  it("names every rating audience in spec §6.1 terms", () => {
    expect(ratingEligibilityLabel("SUBMITTERS_ONLY")).toBe("Team leaders only");
    expect(ratingEligibilityLabel("SUBMITTERS_AND_CONTRIBUTORS")).toBe("All team members");
    expect(ratingEligibilityLabel("JUDGES_ONLY")).toBe("Judges only");
    expect(ratingEligibilityLabel("EVERYONE")).toBe("Everyone signed in");
  });
  it("names roles and platforms", () => {
    expect(jamRoleLabel("MODERATOR")).toBe("Moderator");
    expect(platformLabel("MAC")).toBe("Mac");
    expect(platformLabel("WEB")).toBe("Web");
  });
});
