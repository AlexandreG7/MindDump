import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminUser } from "@/lib/admin";
import {
  getAdminOverview,
  getAdminStorage,
  getAdminUsers,
  parseUsersQuery,
} from "@/lib/adminStats";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // Le middleware garantit déjà une session ; on revérifie ici car c'est le
  // rôle, relu en base, qui fait foi. Un non-admin reçoit une 404 : la page ne
  // révèle même pas son existence.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");

  const admin = await getAdminUser();
  if (!admin) notFound();

  // Requêtes lancées en parallèle, agrégats en cache 60 s.
  const [overview, storage, users] = await Promise.all([
    getAdminOverview(),
    getAdminStorage(),
    getAdminUsers(parseUsersQuery({})),
  ]);

  return <AdminDashboard overview={overview} storage={storage} initialUsers={users} />;
}
