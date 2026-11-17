import { isAdmin } from "@/lib/auth";
import { markPlayed } from "@/lib/jukebox";

export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  await markPlayed(Number(body?.id));
  return Response.json({ ok: true });
}
