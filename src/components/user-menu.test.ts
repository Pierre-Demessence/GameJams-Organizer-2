import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserMenu } from "@/components/user-menu";

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signOut: signOutMock,
}));

type ElementWithProps = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

function findElement(
  node: ReactNode,
  predicate: (node: ElementWithProps) => boolean,
): ElementWithProps | undefined {
  if (!isValidElement(node)) return undefined;
  const element = node as ElementWithProps;
  if (predicate(element)) return element;

  for (const child of Children.toArray(element.props.children)) {
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
    const onClick = signOutItem?.props.onClick;
    expect(onClick).toBeTypeOf("function");
    (onClick as () => void)();
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/" });
  });
});
