import { isAdmin } from "@/lib/auth";
import { claimNext } from "@/lib/jukebox";

export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const allowRandom = Boolean(body?.allowRandom);
  return Response.json({ track: await claimNext(allowRandom) });
}
