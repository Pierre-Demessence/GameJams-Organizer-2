import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "./profile-form";
import { AccountSettings } from "./account-settings";

export const metadata = {
  title: "Settings — GameJam Organizer",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { accounts: { select: { provider: true, providerAccountId: true } } },
  });

  if (!user) redirect("/sign-in");

  return (
    <div className="container mx-auto max-w-2xl space-y-8 px-4 py-8">
      <h1 className="text-3xl font-bold">Settings</h1>
      <ProfileForm
        user={{
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
        }}
      />
      <AccountSettings
        hasPassword={!!user.passwordHash}
        email={user.email}
        linkedAccounts={user.accounts}
      />
    </div>
  );
}
