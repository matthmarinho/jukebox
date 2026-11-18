import { getDeviceId, submitBatch } from "@/lib/jukebox";
import { isSameBarbershopNetwork } from "@/lib/network";

export async function POST(req: Request) {
  const deviceId = await getDeviceId();
  if (!deviceId) return Response.json({ error: "Sessão não encontrada. Recarregue a página." }, { status: 400 });
  const body = await req.json().catch(() => null);

  const onNetwork = await isSameBarbershopNetwork(req, [body?.ipv4, body?.ipv6]);
  if (!onNetwork) {
    return Response.json(
      { error: "Conecte-se ao Wi-Fi da Barbearia Malungo para escolher músicas." },
      { status: 403 },
    );
  }

  const ids = Array.isArray(body?.trackIds) ? body.trackIds.map(Number).filter(Number.isInteger) : [];
  const res = await submitBatch(deviceId, ids);
  return res.ok ? Response.json({ ok: true }) : Response.json({ error: res.error }, { status: 400 });
}
