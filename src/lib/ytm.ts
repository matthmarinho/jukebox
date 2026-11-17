import YTMusic from "ytmusic-api";

// Biblioteca NÃO oficial: pode quebrar se o YouTube Music mudar.
let instance: YTMusic | null = null;

async function client() {
  if (!instance) {
    const y = new YTMusic();
    await y.initialize();
    instance = y;
  }
  return instance;
}

export async function searchAlbums(q: string) {
  const y = await client();
  const res = await y.searchAlbums(q);
  return res.slice(0, 12).map((a) => ({
    albumId: a.albumId,
    name: a.name,
    artist: a.artist?.name ?? "",
    year: a.year ? String(a.year) : null,
    cover: a.thumbnails?.at(-1)?.url ?? null,
  }));
}

export async function getAlbum(albumId: string) {
  const y = await client();
  const a = await y.getAlbum(albumId);
  return {
    name: a.name,
    artist: a.artist?.name ?? "",
    year: a.year ? String(a.year) : null,
    cover: a.thumbnails?.at(-1)?.url ?? null,
    songs: a.songs
      .filter((s) => s.videoId)
      .map((s, i) => ({
        videoId: s.videoId,
        title: s.name,
        artist: s.artist?.name ?? a.artist?.name ?? "",
        duration: s.duration ?? null,
        position: i,
      })),
  };
}
