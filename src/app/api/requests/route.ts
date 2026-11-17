import { getDeviceId, submitBatch } from "@/lib/jukebox";

export async function POST(req: Request) {
  const deviceId = await getDeviceId();
  if (!deviceId) return Response.json({ error: "Sessão não encontrada. Recarregue a página." }, { status: 400 });
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.trackIds) ? body.trackIds.map(Number).filter(Number.isInteger) : [];
  const res = await submitBatch(deviceId, ids);
  return res.ok ? Response.json({ ok: true }) : Response.json({ error: res.error }, { status: 400 });
}
