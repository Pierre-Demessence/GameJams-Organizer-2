import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { JamForm } from "@/app/jams/jam-form";

export const metadata = {
  title: "Create Jam",
};

export default async function CreateJamPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Create a New Jam</h1>
      <JamForm mode="create" />
    </div>
  );
}
