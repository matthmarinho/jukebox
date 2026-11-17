"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else setErr((await res.json()).error);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <form onSubmit={submit} className="ui-panel flex flex-col gap-4 p-6">
        <div>
          <h1 className="ui-section-title">Painel Admin</h1>
          <p className="mt-1 text-xs font-medium text-[#9ca3af]">
            Digite a senha de administrador para continuar.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white">
            Senha
          </label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Digite a senha…"
            className="ui-input"
          />
          {err && <p className="mt-2 text-xs font-semibold text-red-400">{err}</p>}
        </div>

        <button type="submit" disabled={loading || !pw} className="ui-btn ui-btn-primary w-full">
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
