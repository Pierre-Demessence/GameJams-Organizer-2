import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CoverImage } from "@/components/cover-image";
import { buttonVariants } from "@/components/ui/button-variants";
import { initials } from "@/lib/initials";
import { TONE_BG, TONE_TEXT, jamStatus } from "@/lib/jam-status-display";
import { memberSince } from "@/lib/profile";
import { loadProfile, type ProfileGame } from "@/lib/profile-queries";
import { safeHttpUrl } from "@/lib/safe-url";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `${username} — GameJam Organizer` };
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;
  const [profile, session] = await Promise.all([loadProfile(username), auth()]);
  if (!profile) notFound();

  const { user, stats, games, jams } = profile;
  const name = user.displayName ?? user.username;
  const isSelf = session?.user?.id === user.id;
  const avatar = safeHttpUrl(user.avatarUrl);
  const editLink = cn(buttonVariants({ variant: "outline" }), "h-11 w-full text-sm md:h-9");

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pt-6 pb-10 md:grid-cols-12 md:gap-x-12 md:px-12 md:pt-12 md:pb-16">
      <aside className="flex flex-col gap-6 md:col-span-3 md:gap-4.5">
        <div className="flex items-center gap-4 md:flex-col md:items-start md:gap-4.5">
          <Avatar className="size-18 border border-input md:size-30">
            {avatar && <AvatarImage src={avatar} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className="bg-muted text-2xl font-semibold text-brand md:text-[38px]">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-[22px] font-semibold tracking-tight md:text-2xl">{name}</h1>
            <span className="text-sm text-subtle-foreground md:text-[15px]">@{user.username}</span>
          </div>
        </div>
        {user.bio && <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{user.bio}</p>}

        <dl className="grid grid-cols-3 overflow-hidden rounded-xl border md:hidden">
          <MobileStat value={stats.jamsJoined} label="jams joined" />
          <MobileStat value={stats.games} label="games" />
          <MobileStat value={stats.organized} label="organized" last />
        </dl>
        {isSelf && (
          <Link href="/settings" className={editLink}>
            Edit profile
          </Link>
        )}
        <dl className="hidden text-[13px] md:flex md:flex-col">
          <Stat label="Jams joined" value={stats.jamsJoined} />
          <Stat label="Games submitted" value={stats.games} />
          <Stat label="Jams organized" value={stats.organized} />
          <Stat label="Member since" value={memberSince(user.createdAt)} last />
        </dl>
      </aside>

      <div className="flex flex-col gap-6 md:col-span-9 md:gap-9">
        <section aria-labelledby="games" className="flex flex-col gap-2.5 md:gap-3.5">
          <h2 id="games" className="text-lg font-semibold tracking-tight">
            Games
          </h2>
          {games.length === 0 ? (
            <p className="text-sm text-muted-foreground">No games yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3">
              {games.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="jams" className="flex flex-col gap-2.5 md:gap-3.5">
          <h2 id="jams" className="text-lg font-semibold tracking-tight">
            Jams
          </h2>
          {jams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jams yet.</p>
          ) : (
            <>
              <table className="hidden w-full border-collapse text-sm md:table">
                <thead>
                  <tr className="text-left text-xs text-subtle-foreground">
                    <th scope="col" className="border-b pb-2.5 font-medium">Jam</th>
                    <th scope="col" className="w-45 border-b pb-2.5 font-medium">Role</th>
                    <th scope="col" className="w-30 border-b pb-2.5 font-medium">Status</th>
                    <th scope="col" className="w-35 border-b pb-2.5 text-right font-medium">Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {jams.map((j) => {
                    const { label, tone } = jamStatus(j.phase);
                    return (
                      <tr key={j.slug}>
                        <td className="border-b py-3.25">
                          <Link href={`/jams/${j.slug}`} className="font-medium hover:text-brand">
                            {j.name}
                          </Link>
                        </td>
                        <td className="border-b py-3.25 text-muted-foreground">{j.role}</td>
                        <td className="border-b py-3.25">
                          <span className={cn("inline-flex items-center gap-1.5 text-[13px]", TONE_TEXT[tone])}>
                            <span aria-hidden className={cn("size-1.5 rounded-full", TONE_BG[tone])} />
                            {label}
                          </span>
                        </td>
                        <td className="border-b py-3.25 text-right font-mono text-xs text-subtle-foreground">
                          {j.dates}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <ul className="border-t md:hidden">
                {jams.map((j) => {
                  const { label, tone } = jamStatus(j.phase);
                  return (
                    <li key={j.slug} className="flex items-center gap-3 border-b py-3">
                      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TONE_BG[tone])} />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link href={`/jams/${j.slug}`} className="truncate text-sm font-medium hover:text-brand">
                          {j.name}
                        </Link>
                        <span className="text-xs text-subtle-foreground">
                          {j.role} · {label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, last }: { label: string; value: number | string; last?: boolean }) {
  return (
    <div className={cn("flex justify-between py-2.25", !last && "border-b")}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

function MobileStat({ value, label, last }: { value: number; label: string; last?: boolean }) {
  return (
    <div className={cn("flex flex-col-reverse gap-0.5 p-3", !last && "border-r")}>
      <dt className="text-xs text-subtle-foreground">{label}</dt>
      <dd className="font-mono text-lg">{value}</dd>
    </div>
  );
}

function GameCard({ game }: { game: ProfileGame }) {
  const place = game.placement && (
    <span
      className={cn(
        "shrink-0 text-right font-mono text-[11px] md:text-xs",
        game.placement.highlight ? "text-rating" : "text-muted-foreground"
      )}
    >
      {game.placement.label}
    </span>
  );
  return (
    <li className="relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-2.5 md:flex-col md:items-stretch md:gap-0 md:p-0">
      <CoverImage
        src={game.coverUrl}
        alt=""
        name={game.title}
        className="h-11 w-16 shrink-0 rounded-md border text-[10px] md:h-30 md:w-full md:rounded-none md:border-0 md:border-b md:text-base"
      />
      <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-col md:items-stretch md:gap-1 md:px-4 md:py-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:justify-between md:gap-2">
          <Link
            href={`/submissions/${game.id}`}
            className="truncate text-sm font-semibold after:absolute after:inset-0 hover:text-brand md:text-[15px]"
          >
            {game.title}
          </Link>
          <span className="truncate text-xs text-muted-foreground md:hidden">{game.jam.name}</span>
          <span className="hidden md:inline">{place}</span>
        </div>
        <span className="md:hidden">{place}</span>
        {/* Sits above the card's stretched title link so it stays clickable. */}
        <Link
          href={`/jams/${game.jam.slug}`}
          className="relative z-10 hidden truncate text-[13px] text-muted-foreground hover:text-brand md:block"
        >
          {game.jam.name}
        </Link>
        <span className="hidden text-xs text-subtle-foreground md:block">{game.team}</span>
      </div>
    </li>
  );
}
