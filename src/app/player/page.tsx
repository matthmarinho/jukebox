import { Suspense } from "react";
import { isAdmin } from "@/lib/auth";
import AdminLogin from "@/components/AdminLogin";
import Player from "@/components/Player";

async function Gate() {
  return (await isAdmin()) ? <Player /> : <AdminLogin />;
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<p className="p-8 text-neutral-400">Carregando…</p>}>
      <Gate />
    </Suspense>
  );
}
