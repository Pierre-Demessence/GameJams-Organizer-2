import { Children, isValidElement, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserMenu } from "@/components/user-menu";

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signOut: signOutMock,
}));

function findElement(
  node: ReactNode,
  predicate: (node: { props: Record<string, unknown> }) => boolean,
) {
  if (!isValidElement(node)) return undefined;
  if (predicate(node as { props: Record<string, unknown> })) return node;

  for (const child of Children.toArray(node.props.children)) {
    const match = findElement(child, predicate);
    if (match) return match;
  }

  return undefined;
}

describe("UserMenu", () => {
  beforeEach(() => {
    signOutMock.mockReset();
  });

  it("triggers signOut when clicking the Sign Out item", () => {
    const menu = UserMenu({
      user: {
        name: "Test User",
        email: "test@example.com",
      },
    });

    const signOutItem = findElement(
      menu,
      (node) =>
        typeof node.props.onClick === "function" &&
        node.props.children === "Sign Out",
    );

    expect(signOutItem).toBeDefined();
    (
      signOutItem as { props: { onClick: () => void } }
    ).props.onClick();
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/" });
  });
});
