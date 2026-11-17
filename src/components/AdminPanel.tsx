"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LetterFilter, { FilterMode, getFirstLetter } from "./LetterFilter";

type Result = { albumId: string; name: string; artist: string; year: string | null; cover: string | null };
type Album = { id: number; ytAlbumId: string; name: string; artist: string; cover: string | null; tracks: unknown[] };

function coverUrl(url: string | null, size = 240) {
  return url ? url.replace(/=w\d+-h\d+.*$/, `=w${size}-h${size}-l90-rj`) : null;
}

function Cover({ src }: { src: string | null }) {
  const s = coverUrl(src);
  return s ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={s} alt="" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-lg border border-[#2c3036] object-cover" />
  ) : (
    <div className="h-12 w-12 shrink-0 rounded-lg border border-[#2c3036] bg-[#131416]" />
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("album");

  const load = useCallback(async () => {
    setAlbums((await (await fetch("/api/catalog")).json()).albums);
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const added = new Set(albums.map((a) => a.ytAlbumId));

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const a of albums) {
      set.add(getFirstLetter(filterMode === "album" ? a.name : a.artist));
    }
    return set;
  }, [albums, filterMode]);

  const filteredAlbums = useMemo(() => {
    if (!letter) return albums;
    return albums.filter((a) => getFirstLetter(filterMode === "album" ? a.name : a.artist) === letter);
  }, [albums, letter, filterMode]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim() || searching) return;
    setSearching(true);
    setMsg("");
    const res = await fetch("/api/admin/search?q=" + encodeURIComponent(q));
    const d = await res.json();
    setSearching(false);
    if (res.ok) {
      setResults(d.results);
      setMsg(d.results.length ? "" : "Nada encontrado.");
    } else setMsg(d.error);
  };

  const add = async (id: string) => {
    setBusy(id);
    const res = await fetch("/api/admin/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: id }),
    });
    const d = await res.json();
    setBusy(null);
    setMsg(res.ok ? "Álbum adicionado ao catálogo." : d.error);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("Remover álbum? Pedidos dele na fila também serão removidos.")) return;
    await fetch("/api/admin/albums/" + id, { method: "DELETE" });
    load();
  };

  const queueAction = async (action: "skip" | "clear") => {
    if (action === "clear" && !confirm("Limpar toda a fila?")) return;
    await fetch("/api/admin/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setMsg(action === "skip" ? "Música pulada (o player avança em instantes)." : "Fila limpa.");
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Menu superior de administração */}
      <header className="sticky top-0 z-20 border-b border-[#2c3036] bg-[#131416]">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
          <h1 className="text-sm font-extrabold uppercase tracking-wider text-white">
            Painel Admin
          </h1>

          <nav className="flex flex-wrap items-center gap-2">
            <a
              href="/player"
              target="_blank"
              className="ui-btn ui-btn-primary ui-btn-sm"
            >
              Abrir Player
            </a>
            <button
              type="button"
              onClick={() => queueAction("skip")}
              className="ui-btn ui-btn-secondary ui-btn-sm"
            >
              Pular atual
            </button>
            <button
              type="button"
              onClick={() => queueAction("clear")}
              className="ui-btn ui-btn-secondary ui-btn-sm"
            >
              Limpar fila
            </button>
            <button
              type="button"
              onClick={logout}
              className="ui-btn ui-btn-secondary ui-btn-sm"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-5">
        {msg && (
          <div className="ui-panel flex items-center justify-between gap-3 border-[#f5b316] px-4 py-3 text-sm font-semibold text-[#f5b316]">
            <span>{msg}</span>
            <button
              type="button"
              onClick={() => setMsg("")}
              className="ui-btn ui-btn-secondary ui-btn-sm"
            >
              Fechar
            </button>
          </div>
        )}

        <section className="ui-panel p-4 sm:p-5">
          <h2 className="ui-section-title mb-3">Buscar álbum no YouTube Music</h2>
          <form onSubmit={search} className="flex items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar álbum ou artista…"
              className="ui-input flex-1"
            />
            <button
              type="submit"
              disabled={searching || !q.trim()}
              className="ui-btn ui-btn-primary shrink-0"
            >
              {searching ? "Buscando…" : "Buscar"}
            </button>
          </form>

          {results.length > 0 && (
            <ul className="mt-4 divide-y divide-[#2c3036]">
              {results.map((r) => {
                const isAdded = added.has(r.albumId);
                return (
                  <li key={r.albumId} className="flex items-center gap-3.5 py-3">
                    <Cover src={r.cover} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{r.name}</p>
                      <p className="truncate text-xs font-semibold text-[#9ca3af]">
                        {r.artist}
                        {r.year ? ` · ${r.year}` : ""}
                      </p>
                    </div>
                    {isAdded ? (
                      <span className="ui-badge ui-badge-outline shrink-0">
                        ✓ Adicionado
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === r.albumId}
                        onClick={() => add(r.albumId)}
                        className="ui-btn ui-btn-secondary ui-btn-sm shrink-0"
                      >
                        {busy === r.albumId ? "Adicionando…" : "Adicionar"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="ui-panel p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="ui-section-title">
              Álbuns no catálogo ({filteredAlbums.length}{letter ? ` de ${albums.length}` : ""})
            </h2>
            <span className="text-xs font-semibold text-[#9ca3af]">
              {albums.length} {albums.length === 1 ? "cadastrado" : "cadastrados"}
            </span>
          </div>

          <LetterFilter
            letter={letter}
            onChangeLetter={setLetter}
            mode={filterMode}
            onChangeMode={setFilterMode}
            availableLetters={availableLetters}
          />

          {filteredAlbums.length === 0 && (
            <p className="py-4 text-center text-sm font-medium text-[#9ca3af]">
              {albums.length === 0
                ? "Nenhum álbum cadastrado ainda."
                : `Nenhum álbum encontrado com a letra "${letter}".`}
            </p>
          )}
          <ul className="divide-y divide-[#2c3036]">
            {filteredAlbums.map((a) => (
              <li key={a.id} className="flex items-center gap-3.5 py-3">
                <Cover src={a.cover} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{a.name}</p>
                  <p className="truncate text-xs font-semibold text-[#9ca3af]">
                    <span className="text-[#f5b316]">{a.artist}</span> · {a.tracks.length} faixas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="ui-btn ui-btn-danger ui-btn-sm shrink-0"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
