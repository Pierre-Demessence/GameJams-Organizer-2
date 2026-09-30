import { describe, it, expect } from "vitest";
import { initials } from "@/lib/initials";

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Ashes & Embers Jam")).toBe("A&");
    expect(initials("tiny worlds")).toBe("TW");
  });
  it("uses two letters of a single word", () => {
    expect(initials("pixelmira")).toBe("PI");
  });
  it("ignores extra whitespace and handles blanks", () => {
    expect(initials("  One   Button ")).toBe("OB");
    expect(initials("   ")).toBe("?");
  });
});
