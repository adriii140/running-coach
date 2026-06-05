import { auth } from "@/../auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-6xl py-6 px-6">{children}</div>
      </main>
    </div>
  );
}
