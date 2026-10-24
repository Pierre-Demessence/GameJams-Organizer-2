import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { staffAccess } from "@/domain/staff";
import { safeCallbackPath } from "@/lib/safe-url";
import { getStaffRoles } from "@/lib/staff-permissions";
import { getTwoFactorState } from "@/lib/two-factor";
import { TwoFactorForm } from "./two-factor-form";

export const metadata = { title: "Two-factor authentication" };

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=%2Fadmin%2Ftwo-factor");
  const userId = session.user.id;

  if ((await getStaffRoles(userId)).length === 0) notFound();
  const state = await getTwoFactorState(userId);

  const raw = (await searchParams).callbackUrl;
  const requested = safeCallbackPath(Array.isArray(raw) ? raw[0] : raw);
  const callbackUrl = requested === "/" ? "/admin" : requested;

  if (staffAccess({ hasRole: true, ...state }).allowed) redirect(callbackUrl);

  return <TwoFactorForm mode={state.enrolled ? "verify" : "enrol"} callbackUrl={callbackUrl} />;
}
