import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserMenu } from "@/components/user-menu";

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signOut: signOutMock,
}));

type ElementWithProps = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

function findElement(
  node: ReactNode,
  predicate: (node: ElementWithProps) => boolean
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

  const linkHref = (node: ElementWithProps): string | undefined =>
    isValidElement(node.props.render)
      ? ((node.props.render as ElementWithProps).props.href as string | undefined)
      : undefined;

  it("triggers signOut when clicking Sign out", () => {
    const menu = UserMenu({ user: { name: "Test User", username: "tester" } });
    // The item renders an icon before its label, so children is an array.
    const item = findElement(
      menu,
      (node) =>
        typeof node.props.onClick === "function" &&
        Children.toArray(node.props.children).includes("Sign out")
    );
    expect(item).toBeDefined();
    (item?.props.onClick as () => void)();
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("links to the user's profile when the username is known", () => {
    const menu = UserMenu({ user: { name: "Test User", username: "tester" } });
    expect(findElement(menu, (n) => linkHref(n) === "/users/tester")).toBeDefined();
    expect(findElement(menu, (n) => linkHref(n) === "/settings")).toBeDefined();
  });

  it("hides the profile link for sessions without a username", () => {
    const menu = UserMenu({ user: { name: "Test User" } });
    expect(
      findElement(menu, (n) => linkHref(n)?.startsWith("/users/") ?? false)
    ).toBeUndefined();
    expect(findElement(menu, (n) => linkHref(n) === "/settings")).toBeDefined();
  });
});
