import { getDeviceState, getOrCreateDeviceId } from "@/lib/jukebox";

export async function GET() {
  const deviceId = await getOrCreateDeviceId();
  return Response.json(await getDeviceState(deviceId));
}
