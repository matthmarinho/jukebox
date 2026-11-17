"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Track = {
  id: number;
  video_id: string;
  title: string;
  artist: string;
  cover: string | null;
  is_auto?: boolean;
};
type QItem = { id: number; status: string; title: string; artist: string };

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos sem escolhas de clientes

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function fmtCountdown(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Player() {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<QItem[]>([]);
  const [note, setNote] = useState("");
  const [idleRemainingMs, setIdleRemainingMs] = useState(IDLE_TIMEOUT_MS);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const currentRef = useRef<Track | null>(null);
  const busyRef = useRef(false);
  const lastCustomerActivityRef = useRef<number>(0);

  const loadQueue = useCallback(async () => {
    const r = await fetch("/api/queue");
    if (r.ok) setQueue((await r.json()).queue);
  }, []);

  const playNext = useCallback(async () => {
    const player = playerRef.current;
    if (busyRef.current || typeof player?.loadVideoById !== "function") return;
    busyRef.current = true;
    try {
      const idleElapsed = Date.now() - lastCustomerActivityRef.current;
      const allowRandom = idleElapsed >= IDLE_TIMEOUT_MS;

      const res = await fetch("/api/player/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowRandom }),
      });
      if (res.status === 401) {
        setNote("Sessão expirada. Recarregue e entre novamente.");
        return;
      }
      const { track } = (await res.json()) as { track: Track | null };
      if (track && currentRef.current?.id !== track.id) {
        if (!track.is_auto) {
          lastCustomerActivityRef.current = Date.now();
        }
        currentRef.current = track;
        setCurrent(track);
        setNote("");
        player.loadVideoById(track.video_id);
        player.playVideo?.();
      } else if (!track) {
        currentRef.current = null;
        setCurrent(null);
      }
      loadQueue();
    } finally {
      busyRef.current = false;
    }
  }, [loadQueue]);

  const finish = useCallback(async () => {
    const cur = currentRef.current;
    if (cur) {
      if (!cur.is_auto) {
        lastCustomerActivityRef.current = Date.now();
      }
      await fetch("/api/player/done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cur.id }),
      });
      currentRef.current = null;
    }
    await playNext();
  }, [playNext]);

  const playNextRef = useRef(playNext);
  const finishRef = useRef(finish);
  useEffect(() => {
    playNextRef.current = playNext;
    finishRef.current = finish;
  }, [playNext, finish]);

  useEffect(() => {
    if (!started || !hostRef.current) return;
    lastCustomerActivityRef.current = Date.now();
    let instance: any = null;
    let cancelled = false;

    const init = () => {
      if (cancelled || !hostRef.current) return;
      hostRef.current.innerHTML = "";
      const target = document.createElement("div");
      hostRef.current.appendChild(target);

      instance = new window.YT.Player(target, {
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: (e: any) => {
            if (cancelled) return;
            playerRef.current = e.target;
            void playNextRef.current();
          },
          onStateChange: (e: any) => {
            if (e.data === 0) void finishRef.current();
            if (e.data === 5) e.target?.playVideo?.();
          },
          onError: () => {
            if (!currentRef.current) return;
            setNote("Vídeo indisponível, pulando…");
            void finishRef.current();
          },
        },
      });
    };

    if (window.YT?.Player) {
      init();
    } else {
      window.onYouTubeIframeAPIReady = init;
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
    }

    return () => {
      cancelled = true;
      playerRef.current = null;
      try {
        instance?.destroy?.();
      } catch {
        // ignore
      }
    };
  }, [started]);

  // Atualiza o contador de inatividade de 1 em 1 segundo e dispara o modo aleatório ao atingir 5 minutos
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => {
      const cur = currentRef.current;
      if (cur && !cur.is_auto) {
        lastCustomerActivityRef.current = Date.now();
        setIdleRemainingMs(IDLE_TIMEOUT_MS);
        return;
      }
      const rem = Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - lastCustomerActivityRef.current));
      setIdleRemainingMs(rem);
      if (rem === 0 && !currentRef.current) {
        void playNextRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [started]);

  // Poll da fila a cada 5 segundos
  useEffect(() => {
    if (!started) return;
    const t = setInterval(async () => {
      const r = await fetch("/api/queue");
      if (!r.ok) return;
      const { queue: q } = (await r.json()) as { queue: QItem[] };
      setQueue(q);
      const playing = q.find((i) => i.status === "playing");
      if (!playing || playing.id !== currentRef.current?.id) {
        currentRef.current = null;
        void playNext();
      }
    }, 5000);
    return () => clearInterval(t);
  }, [started, playNext]);

  if (!started) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center">
        <Image src="/logo.png" alt="Malungo Barbearia" width={140} height={140} priority className="rounded-xl" />
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="ui-btn ui-btn-primary ui-btn-lg mt-1"
        >
          Iniciar Jukebox
        </button>
      </main>
    );
  }

  const upcoming = queue.filter((q) => q.status === "queued");

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl gap-5 p-4 lg:grid-cols-[2fr_1fr]">
      <section className="flex flex-col gap-4">
        <div ref={hostRef} className="ui-panel aspect-video w-full overflow-hidden bg-black" />
        <div className="ui-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="ui-section-title">Tocando agora</p>
            {current?.is_auto && (
              <span className="ui-badge ui-badge-outline">Modo aleatório</span>
            )}
          </div>
          <p className="mt-1 text-xl font-extrabold uppercase text-white sm:text-2xl">
            {current?.title ?? "Aguardando pedidos…"}
          </p>
          <p className="mt-0.5 text-sm font-bold uppercase tracking-wider text-[#f5b316]">
            {current ? (
              current.artist
            ) : (
              <span className="text-xs font-semibold normal-case tracking-normal text-[#9ca3af]">
                Modo aleatório inicia em {fmtCountdown(idleRemainingMs)} se ninguém escolher
              </span>
            )}
          </p>
          {note && <p className="mt-2 text-xs font-semibold text-red-400">{note}</p>}
        </div>
      </section>
      <aside className="ui-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="ui-section-title">Próximas na fila</h2>
          <span className="text-xs font-bold text-[#9ca3af]">{upcoming.length}</span>
        </div>
        {upcoming.length === 0 && <p className="text-sm text-[#9ca3af]">Nenhuma música na fila.</p>}
        <ol className="divide-y divide-[#2c3036]">
          {upcoming.slice(0, 15).map((q, idx) => (
            <li key={q.id} className="flex items-center gap-2.5 py-2.5 text-sm">
              <span className="w-5 shrink-0 text-xs font-bold text-[#9ca3af]">{idx + 1}.</span>
              <div className="min-w-0 flex-1 truncate">
                <span className="font-bold text-white">{q.title}</span>{" "}
                <span className="text-[#9ca3af]">— {q.artist}</span>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </main>
  );
}
