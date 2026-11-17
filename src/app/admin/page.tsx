import { Suspense } from "react";
import { isAdmin } from "@/lib/auth";
import AdminLogin from "@/components/AdminLogin";
import AdminPanel from "@/components/AdminPanel";

async function Gate() {
  return (await isAdmin()) ? <AdminPanel /> : <AdminLogin />;
}

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-8 text-neutral-400">Carregando…</p>}>
      <Gate />
    </Suspense>
  );
}
