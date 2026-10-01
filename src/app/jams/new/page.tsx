import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { JamForm } from "@/app/jams/jam-form";

export const metadata = {
  title: "Host a jam",
};

export default async function CreateJamPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=%2Fjams%2Fnew");

  return <JamForm mode="create" />;
}
