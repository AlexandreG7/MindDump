import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConsentForm } from "./ConsentForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consentement",
  robots: { index: false, follow: false },
};

// Chemin interne uniquement (pas de redirection ouverte).
function safeCallback(value: string | undefined) {
  return value && /^\/(?![\/\\])/.test(value) && !value.startsWith("/consentement") ? value : "/";
}

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/consentement");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { consentedAt: true },
  });
  if (!user) redirect("/login");

  return (
    <ConsentForm
      alreadyConsented={!!user.consentedAt}
      callbackUrl={safeCallback(searchParams.callbackUrl)}
    />
  );
}
