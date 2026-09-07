import { ActorSwitch } from "@/components/dev/actor-switch";
import { BottomNav } from "@/components/shell/bottom-nav";
import { currentActor, devActorEnabled } from "@/lib/dev-actor";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  const zeigeSwitch = devActorEnabled();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-linie bg-flaeche border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-koenigsblau text-lg font-bold tracking-tight">tutr</span>
          {zeigeSwitch ? <ActorSwitch aktuell={actor?.role ?? "student"} /> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">{children}</main>

      <BottomNav />
    </div>
  );
}
