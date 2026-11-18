"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getClientPublicIps } from "@/lib/client-ip";
import LetterFilter, { FilterMode, getFirstLetter } from "./LetterFilter";

type Track = { id: number; title: string; artist: string; duration: number | null };
type Album = { id: number; name: string; artist: string; cover: string | null; year: string | null; tracks: Track[] };
type Me = {
  picks: { id: number; title: string; artist: string; status: "queued" | "playing" | "played" }[];
  played: number;
  slotsLeft: number;
  remaining: number;
  canPick: boolean;
  onNetwork: boolean;
};
type QItem = { id: number; status: "queued" | "playing"; title: string; artist: string; cover: string | null };

const SIZE = 4;

function coverUrl(url: string | null, size = 600) {
  return url ? url.replace(/=w\d+-h\d+.*$/, `=w${size}-h${size}-l90-rj`) : null;
}

function fmtDuration(sec: number | null) {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Jukebox() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [queue, setQueue] = useState<QItem[]>([]);
  const [selected, setSelected] = useState<Map<number, Track>>(new Map());
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("album");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    const ips = await getClientPublicIps();
    const qs = new URLSearchParams();
    if (ips.ipv4) qs.set("ipv4", ips.ipv4);
    if (ips.ipv6) qs.set("ipv6", ips.ipv6);
    const [m, q] = await Promise.all([fetch(`/api/me?${qs.toString()}`), fetch("/api/queue")]);
    if (m.ok) setMe(await m.json());
    if (q.ok) setQueue((await q.json()).queue);
  }, []);

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => setAlbums(d.albums));
    const t0 = setTimeout(refresh, 0);
    const t = setInterval(refresh, 8000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [refresh]);

  useEffect(() => {
    if (!openAlbum) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenAlbum(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAlbum]);

  const maxSelectable = me ? me.slotsLeft : SIZE;

  const toggle = (t: Track) => {
    setMsg(null);
    setSelected((prev) => {
      const n = new Map(prev);
      if (n.has(t.id)) n.delete(t.id);
      else if (n.size < maxSelectable) n.set(t.id, t);
      return n;
    });
  };

  const send = async () => {
    if (sending || selected.size < 1) return;
    setSending(true);
    setMsg(null);
    const ips = await getClientPublicIps();
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackIds: [...selected.keys()], ...ips }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setSelected(new Map());
      setOpenAlbum(null);
      setMsg({ type: "ok", text: "Músicas adicionadas à fila." });
    } else {
      setMsg({ type: "err", text: data.error });
    }
    refresh();
  };

  const offNetwork = me ? !me.onNetwork : false;
  const locked = me ? !me.canPick || offNetwork : false;
  const countIn = (a: Album) => a.tracks.filter((t) => selected.has(t.id)).length;
  const myRequestIds = useMemo(() => new Set(me?.picks.map((p) => p.id) ?? []), [me]);
  const nowPlaying = queue.find((q) => q.status === "playing") ?? queue[0] ?? null;

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

  return (
    <div className={selected.size > 0 ? "min-h-screen pb-24" : "min-h-screen pb-10"}>
      {/* Barra superior */}
      <header className="sticky top-0 z-20 border-b border-[#2c3036] bg-[#131416]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Malungo Barbearia"
              width={44}
              height={44}
              priority
              className="rounded-lg"
            />
            <h1 className="malungo-title text-xl leading-none">JUKEBOX</h1>
          </div>

          <span className="ui-badge ui-badge-outline">
            {offNetwork
              ? "Fora do Wi-Fi"
              : locked
                ? `Aguarde (${me?.remaining})`
                : `${maxSelectable - selected.size} restantes`}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 pt-4">
        {/* Aviso de feedback */}
        {msg && (
          <div
            className={`ui-panel flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold ${
              msg.type === "ok"
                ? "border-[#f5b316] text-[#f5b316]"
                : "border-red-500/60 bg-red-950/60 text-red-200"
            }`}
          >
            <span>{msg.text}</span>
            <button
              type="button"
              onClick={() => setMsg(null)}
              className="ui-btn ui-btn-secondary ui-btn-sm"
            >
              OK
            </button>
          </div>
        )}

        {/* Aviso se o cliente não estiver conectado ao Wi-Fi da barbearia */}
        {offNetwork && (
          <div className="ui-panel border-red-500/60 bg-red-950/60 px-4 py-3 text-xs font-semibold text-red-200">
            Conecte-se ao Wi-Fi da Barbearia Malungo para escolher músicas.
          </div>
        )}

        {/* Aviso apenas quando o limite de 4 foi atingido */}
        {!offNetwork && locked && me && (
          <div className="ui-panel border-[#f5b316]/50 px-4 py-3 text-xs font-semibold text-[#f5b316]">
            Limite de {SIZE} músicas atingido. Você poderá escolher novamente quando {me.remaining}{" "}
            {me.remaining === 1 ? "música sua tocar" : "músicas suas tocarem"}.
          </div>
        )}

        {/* Faixa compacta de Tocando Agora / Fila expansível (unifica Fila + Suas escolhas sem duplicar) */}
        {nowPlaying && (
          <section className="ui-panel overflow-hidden">
            <button
              type="button"
              onClick={() => setShowQueue((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#24272b]/50"
            >
              <div className="min-w-0 flex-1 truncate text-sm">
                <span className="mr-2 text-xs font-extrabold uppercase tracking-wider text-[#f5b316]">
                  {nowPlaying.status === "playing" ? "Tocando:" : "Próxima:"}
                </span>
                <span className="font-bold text-white">{nowPlaying.title}</span>{" "}
                <span className="text-[#9ca3af]">— {nowPlaying.artist}</span>
              </div>
              <span className="shrink-0 text-xs font-bold text-[#9ca3af]">
                {showQueue ? "Ocultar ▲" : `Ver fila (${queue.length}) ▼`}
              </span>
            </button>

            {showQueue && (
              <ol className="divide-y divide-[#2c3036] border-t border-[#2c3036] px-4 py-1">
                {queue.map((q, idx) => {
                  const isMine = myRequestIds.has(q.id);
                  return (
                    <li key={q.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="w-5 shrink-0 text-xs font-bold text-[#9ca3af]">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0 flex-1 truncate">
                          <span className={q.status === "playing" ? "font-bold text-[#f5b316]" : "font-semibold text-white"}>
                            {q.title}
                          </span>{" "}
                          <span className="text-[#9ca3af]">— {q.artist}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isMine && <span className="ui-badge ui-badge-outline">Sua</span>}
                        {q.status === "playing" && <span className="ui-badge ui-badge-brand">Tocando</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}

        {/* Catálogo de Álbuns */}
        <section>
          <LetterFilter
            letter={letter}
            onChangeLetter={setLetter}
            mode={filterMode}
            onChangeMode={setFilterMode}
            availableLetters={availableLetters}
          />

          {filteredAlbums.length === 0 && (
            <div className="ui-panel p-8 text-center text-sm font-medium text-[#9ca3af]">
              {albums.length === 0
                ? "Nenhum álbum disponível ainda."
                : `Nenhum álbum encontrado com a letra "${letter}".`}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4">
            {filteredAlbums.map((a) => {
              const n = countIn(a);
              const src = coverUrl(a.cover);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setOpenAlbum(a)}
                  className={`group relative aspect-square overflow-hidden rounded-xl bg-[#1b1d20] text-left transition ${
                    n > 0
                      ? "border-2 border-[#f5b316]"
                      : "border border-[#2c3036] hover:border-[#f5b316]"
                  }`}
                >
                  {src && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={a.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  )}

                  {n > 0 && (
                    <span className="ui-badge ui-badge-brand absolute right-2.5 top-2.5 min-w-6">
                      {n}
                    </span>
                  )}

                  <div className="absolute inset-x-0 bottom-0 border-t border-[#2c3036] bg-[#131416]/95 p-3">
                    <p className="line-clamp-1 text-xs font-extrabold uppercase text-white sm:text-sm">
                      {a.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wider text-[#f5b316]">
                      {a.artist}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* Modal centralizado para escolher as músicas do álbum */}
      {openAlbum && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpenAlbum(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={openAlbum.name}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#2c3036] bg-[#1b1d20]"
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-center gap-3.5 border-b border-[#2c3036] bg-[#131416] p-4">
              {coverUrl(openAlbum.cover, 200) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl(openAlbum.cover, 200)!}
                  alt={openAlbum.name}
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 shrink-0 rounded-lg border border-[#2c3036] object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold uppercase text-white sm:text-base">
                  {openAlbum.name}
                </p>
                <p className="truncate text-xs font-bold uppercase tracking-wider text-[#f5b316]">
                  {openAlbum.artist}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenAlbum(null)}
                aria-label="Fechar"
                className="ui-btn ui-btn-secondary h-9 w-9 p-0"
              >
                ✕
              </button>
            </div>

            {/* Lista de Faixas */}
            <div className="flex-1 divide-y divide-[#2c3036] overflow-y-auto p-2">
              {openAlbum.tracks.map((t, i) => {
                const on = selected.has(t.id);
                const disabled = locked || (!on && selected.size >= maxSelectable);
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(t)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                      on
                        ? "bg-[#24272b] text-[#f5b316]"
                        : "text-white hover:bg-[#24272b]/60"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs font-extrabold transition ${
                        on
                          ? "border-[#f5b316] bg-[#f5b316] text-[#131416]"
                          : "border-[#2c3036] bg-[#131416] text-[#9ca3af]"
                      }`}
                    >
                      {on ? "✓" : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.title}</span>
                    {t.duration ? (
                      <span className="shrink-0 font-mono text-xs text-[#9ca3af]">{fmtDuration(t.duration)}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Rodapé do Modal (apenas se houver seleção) */}
            {selected.size > 0 && !locked && (
              <div className="flex items-center justify-between gap-3 border-t border-[#2c3036] bg-[#131416] p-4">
                <span className="text-xs font-bold text-[#9ca3af]">
                  {selected.size} de {maxSelectable} {selected.size === 1 ? "selecionada" : "selecionadas"}
                </span>
                <button
                  type="button"
                  disabled={sending}
                  onClick={send}
                  className="ui-btn ui-btn-primary"
                >
                  {sending ? "Enviando…" : `Enviar (${selected.size})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barra inferior fixa — aparece apenas quando há músicas selecionadas */}
      {selected.size > 0 && !locked && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#2c3036] bg-[#131416] p-3.5">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[#9ca3af] sm:text-sm">
              <span className="font-extrabold text-[#f5b316]">{selected.size}</span>:{" "}
              <span className="text-white">
                {[...selected.values()].map((t) => t.title).join(", ")}
              </span>
            </p>
            <button
              type="button"
              disabled={sending}
              onClick={send}
              className="ui-btn ui-btn-primary shrink-0"
            >
              {sending ? "Enviando…" : `Enviar (${selected.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
