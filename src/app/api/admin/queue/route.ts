import { isAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

// Ações: skip (pula a atual) | clear (limpa a fila). Contam como "tocadas" para não travar usuários.
export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.action === "skip") {
    await query(`UPDATE requests SET status='played', played_at=now() WHERE status='playing'`);
  } else if (body?.action === "clear") {
    await query(`UPDATE requests SET status='played', played_at=now() WHERE status IN ('queued','playing')`);
  } else {
    return Response.json({ error: "Ação inválida" }, { status: 400 });
  }
  return Response.json({ ok: true });
}
