import { connection } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  await connection();
  const rows = await query<{
    yt_album_id: string; album_id: number; album: string; artist: string; cover: string | null; year: string | null;
    track_id: number | null; title: string | null; track_artist: string | null; duration_sec: number | null;
  }>(
    `SELECT a.yt_album_id, a.id AS album_id, a.name AS album, a.artist, a.cover, a.year,
            t.id AS track_id, t.title, t.artist AS track_artist, t.duration_sec
       FROM albums a LEFT JOIN tracks t ON t.album_id = a.id
      ORDER BY a.created_at DESC, a.id DESC, t.position`,
  );
  const map = new Map<number, {
    id: number; ytAlbumId: string; name: string; artist: string; cover: string | null; year: string | null;
    tracks: { id: number; title: string; artist: string; duration: number | null }[];
  }>();
  for (const r of rows) {
    if (!map.has(r.album_id)) {
      map.set(r.album_id, { id: r.album_id, ytAlbumId: r.yt_album_id, name: r.album, artist: r.artist, cover: r.cover, year: r.year, tracks: [] });
    }
    if (r.track_id) {
      map.get(r.album_id)!.tracks.push({
        id: r.track_id, title: r.title!, artist: r.track_artist!, duration: r.duration_sec,
      });
    }
  }
  return Response.json({ albums: [...map.values()] });
}
