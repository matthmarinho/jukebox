import { isAdmin } from "@/lib/auth";
import { claimNext } from "@/lib/jukebox";
import { updateBarbershopNetwork } from "@/lib/network";

export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const allowRandom = Boolean(body?.allowRandom);
  await updateBarbershopNetwork(req, [body?.ipv4, body?.ipv6]);
  return Response.json({ track: await claimNext(allowRandom) });
}
