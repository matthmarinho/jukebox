import { isAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { getAlbum } from "@/lib/ytm";

export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const albumId = String(body?.albumId ?? "");
  if (!albumId) return Response.json({ error: "albumId obrigatório" }, { status: 400 });

  let album;
  try {
    album = await getAlbum(albumId);
  } catch (e) {
    return Response.json({ error: "Falha ao ler o álbum: " + (e as Error).message }, { status: 502 });
  }
  if (!album.songs.length) return Response.json({ error: "Álbum sem faixas." }, { status: 400 });

  const existing = await query(`SELECT id FROM albums WHERE yt_album_id = $1`, [albumId]);
  if (existing.length) return Response.json({ error: "Álbum já adicionado." }, { status: 409 });

  const [row] = await query<{ id: number }>(
    `INSERT INTO albums(yt_album_id, name, artist, cover, year) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [albumId, album.name, album.artist, album.cover, album.year],
  );
  await query(
    `INSERT INTO tracks(album_id, video_id, title, artist, duration_sec, position)
     SELECT $1, v, t, a, d, p FROM unnest($2::text[], $3::text[], $4::text[], $5::int[], $6::int[]) AS x(v,t,a,d,p)`,
    [
      row.id,
      album.songs.map((s) => s.videoId),
      album.songs.map((s) => s.title),
      album.songs.map((s) => s.artist),
      album.songs.map((s) => s.duration),
      album.songs.map((s) => s.position),
    ],
  );
  return Response.json({ ok: true, id: row.id });
}
