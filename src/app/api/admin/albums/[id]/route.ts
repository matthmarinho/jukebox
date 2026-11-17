import { isAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await ctx.params;
  await query(`DELETE FROM albums WHERE id = $1`, [Number(id)]);
  return Response.json({ ok: true });
}
