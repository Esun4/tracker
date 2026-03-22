import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardNav user={session.user} />
      <main className="flex-1 mx-auto px-16 lg:px-24 py-6 w-full">
        {children}
      </main>
    </div>
  );
}
