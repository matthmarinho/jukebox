import { isAdmin } from "@/lib/auth";
import { searchAlbums } from "@/lib/ytm";

export async function GET(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });
  try {
    return Response.json({ results: await searchAlbums(q) });
  } catch (e) {
    return Response.json({ error: "Falha ao buscar no YouTube Music: " + (e as Error).message }, { status: 502 });
  }
}
