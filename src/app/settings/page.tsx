import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "./profile-form";
import { PasswordSection, SignInMethods } from "./account-settings";
import { AppearancePicker } from "./appearance-picker";

export const metadata = {
  title: "Settings — GameJam Organizer",
};

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "sign-in", label: "Sign-in methods" },
  { id: "password", label: "Email & password" },
  { id: "appearance", label: "Appearance" },
];

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { accounts: { select: { provider: true } } },
  });

  if (!user) redirect("/sign-in");

  const hasPassword = Boolean(user.passwordHash);
  const providers = [...new Set(user.accounts.map((a) => a.provider))];

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-x-12 px-4 pt-6 pb-16 md:grid-cols-12 md:px-12 md:pt-10">
      <nav aria-label="Settings sections" className="sticky top-6 hidden flex-col gap-0.5 pt-18 md:col-span-3 md:flex">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex h-8.5 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-10 md:col-span-9 lg:col-span-7">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Your public profile and how you sign in.</p>
        </div>

        <Section id="profile" title="Profile">
          <ProfileForm
            user={{
              username: user.username,
              displayName: user.displayName,
              bio: user.bio,
              avatarUrl: user.avatarUrl,
            }}
          />
        </Section>

        <Section
          id="sign-in"
          title="Sign-in methods"
          description="Link several so you can sign in either way. Keep at least one."
        >
          <SignInMethods hasPassword={hasPassword} email={user.email} providers={providers} />
        </Section>

        <Section
          id="password"
          title="Email & password"
          description={
            hasPassword
              ? "Change the password you sign in with."
              : "Optional when you sign in with Discord. Add one to sign in without it."
          }
        >
          <PasswordSection hasPassword={hasPassword} email={user.email} />
        </Section>

        <Section id="appearance" title="Appearance">
          <AppearancePicker />
        </Section>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-6 flex-col gap-4.5 border-t pt-8 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
