import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkJamPermission } from "@/lib/permissions";
import { RoleManager } from "./role-manager";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jam = await db.jam.findUnique({ where: { slug }, select: { name: true } });
  return { title: jam ? `Manage ${jam.name}` : "Manage Jam" };
}

export default async function ManageJamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const { slug } = await params;
  const jam = await db.jam.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      createdById: true,
      roles: {
        include: {
          user: { select: { username: true, displayName: true } },
        },
        orderBy: { role: "asc" },
      },
    },
  });

  if (!jam) notFound();

  const canManage = await checkJamPermission(
    jam.id,
    session.user.id,
    "manage_roles"
  );
  if (!canManage) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Manage {jam.name}</h1>
      <RoleManager
        jamId={jam.id}
        creatorId={jam.createdById}
        roles={jam.roles}
      />
    </div>
  );
}
