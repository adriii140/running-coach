import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ChatInterface } from "@/components/coach/ChatInterface";

export default async function CoachPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-4 h-full">
      <div>
        <h1 className="text-2xl font-bold">Coach AI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tu entrenador personal con acceso a todos tus datos
        </p>
      </div>
      <ChatInterface />
    </div>
  );
}
