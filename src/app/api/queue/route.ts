import { connection } from "next/server";
import { getQueue } from "@/lib/jukebox";

export async function GET() {
  await connection();
  const q = await getQueue();
  return Response.json({ queue: q.map((i) => ({ id: i.id, status: i.status, title: i.title, artist: i.artist, cover: i.cover })) });
}

