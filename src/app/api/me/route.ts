import { getDeviceState, getOrCreateDeviceId } from "@/lib/jukebox";
import { isSameBarbershopNetwork } from "@/lib/network";

export async function GET(req: Request) {
  const deviceId = await getOrCreateDeviceId();
  const url = new URL(req.url);
  const [state, onNetwork] = await Promise.all([
    getDeviceState(deviceId),
    isSameBarbershopNetwork(req, [url.searchParams.get("ipv4"), url.searchParams.get("ipv6")]),
  ]);
  return Response.json({ ...state, onNetwork });
}
