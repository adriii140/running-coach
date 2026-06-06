import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/shared/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={{ name: session.name, image: session.image }} />
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-6xl py-6 px-6">{children}</div>
      </main>
    </div>
  );
}
