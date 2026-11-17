import { cookies } from "next/headers";
import { query } from "./db";

export const BATCH_SIZE = 4;
export const UNLOCK_AFTER = 2;
const DEVICE_COOKIE = "jb_device";

export async function getOrCreateDeviceId() {
  const store = await cookies();
  let id = store.get(DEVICE_COOKIE)?.value;
  if (!id) {
    id = crypto.randomUUID();
    store.set(DEVICE_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return id;
}

export async function getDeviceId() {
  return (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
}

export type DevicePick = {
  id: number;
  title: string;
  artist: string;
  status: "queued" | "playing" | "played";
};

export async function getDeviceState(deviceId: string) {
  const latestBatch = await query<{ id: number }>(
    `SELECT id FROM batches WHERE device_id = $1 ORDER BY id DESC LIMIT 1`,
    [deviceId],
  );
  const batchId = latestBatch[0]?.id ?? null;

  const picks = batchId
    ? await query<DevicePick>(
        `SELECT r.id, t.title, t.artist, r.status
           FROM requests r JOIN tracks t ON t.id = r.track_id
          WHERE r.batch_id = $1
          ORDER BY r.id`,
        [batchId],
      )
    : [];

  const played = picks.filter((p) => p.status === "played").length;
  // Se não há lote ou 2 músicas do lote atual já tocaram, libera um novo lote de 4.
  // Caso contrário, o usuário ainda pode escolher as vagas restantes até completar 4 no lote atual.
  const unlockedNewBatch = !batchId || played >= UNLOCK_AFTER;
  const slotsLeft = unlockedNewBatch ? BATCH_SIZE : Math.max(0, BATCH_SIZE - picks.length);
  const canPick = slotsLeft > 0;
  const remaining = canPick ? 0 : Math.max(0, UNLOCK_AFTER - played);

  return { batchId, unlockedNewBatch, picks, played, slotsLeft, remaining, canPick };
}

export async function submitBatch(deviceId: string, trackIds: number[]) {
  const unique = [...new Set(trackIds)];
  const state = await getDeviceState(deviceId);
  if (!state.canPick) {
    return {
      ok: false as const,
      error: `Aguarde: faltam ${state.remaining} das suas músicas tocarem para escolher mais.`,
    };
  }
  if (unique.length < 1 || unique.length > state.slotsLeft) {
    return {
      ok: false as const,
      error:
        state.slotsLeft === 1
          ? "Você ainda pode escolher mais 1 música neste lote."
          : `Escolha de 1 a ${state.slotsLeft} músicas diferentes.`,
    };
  }
  const valid = await query<{ id: number }>(`SELECT id FROM tracks WHERE id = ANY($1::int[])`, [unique]);
  if (valid.length !== unique.length) return { ok: false as const, error: "Música inválida." };

  const dup = await query<{ title: string }>(
    `SELECT t.title FROM requests r JOIN tracks t ON t.id = r.track_id
      WHERE r.status IN ('queued','playing') AND r.track_id = ANY($1::int[])`,
    [unique],
  );
  if (dup.length) {
    return {
      ok: false as const,
      error: `Já está na fila: ${dup.map((d) => d.title).join(", ")}. Escolha outra.`,
    };
  }

  if (state.unlockedNewBatch || !state.batchId) {
    await query(
      `WITH b AS (INSERT INTO batches(device_id) VALUES ($1) RETURNING id)
       INSERT INTO requests(batch_id, device_id, track_id)
       SELECT b.id, $1, t FROM b, unnest($2::int[]) WITH ORDINALITY AS u(t, n) ORDER BY u.n`,
      [deviceId, unique],
    );
  } else {
    await query(
      `INSERT INTO requests(batch_id, device_id, track_id)
       SELECT $1, $2, t FROM unnest($3::int[]) WITH ORDINALITY AS u(t, n) ORDER BY u.n`,
      [state.batchId, deviceId, unique],
    );
  }
  return { ok: true as const };
}

export type QueueItem = {
  id: number;
  status: "queued" | "playing";
  video_id: string;
  title: string;
  artist: string;
  cover: string | null;
  is_auto: boolean;
};

export async function getQueue() {
  return query<QueueItem>(
    `SELECT r.id, r.status, t.video_id, t.title, t.artist, a.cover, (r.device_id = '__auto__') AS is_auto
       FROM requests r
       JOIN tracks t ON t.id = r.track_id
       JOIN albums a ON a.id = t.album_id
      WHERE r.status IN ('queued','playing')
      ORDER BY (r.status = 'playing') DESC, r.id
      LIMIT 100`,
  );
}

/** Retorna a música atual (playing), promove a próxima da fila ou, se allowRandom=true, sorteia uma música aleatória. */
export async function claimNext(allowRandom = false) {
  const rows = await query<QueueItem>(
    `WITH cur AS (
       SELECT id FROM requests WHERE status = 'playing' ORDER BY id LIMIT 1
     ), nxt AS (
       SELECT id FROM requests WHERE status = 'queued'
        AND NOT EXISTS (SELECT 1 FROM cur) ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED
     ), upd AS (
       UPDATE requests SET status = 'playing' WHERE id IN (SELECT id FROM nxt) RETURNING id
     )
     SELECT r.id, r.status, t.video_id, t.title, t.artist, a.cover, (r.device_id = '__auto__') AS is_auto
       FROM requests r JOIN tracks t ON t.id = r.track_id JOIN albums a ON a.id = t.album_id
      WHERE r.id IN (SELECT id FROM cur UNION SELECT id FROM upd)`,
  );
  if (rows[0] || !allowRandom) return rows[0] ?? null;

  const autoRows = await query<QueueItem>(
    `WITH last_req AS (
       SELECT track_id FROM requests ORDER BY id DESC LIMIT 1
     ), rnd AS (
       SELECT id AS track_id FROM tracks
        ORDER BY (id = COALESCE((SELECT track_id FROM last_req), -1)) ASC, random()
        LIMIT 1
     ), b AS (
       INSERT INTO batches(device_id)
       SELECT '__auto__' FROM rnd
       RETURNING id
     ), ins AS (
       INSERT INTO requests(batch_id, device_id, track_id, status)
       SELECT b.id, '__auto__', rnd.track_id, 'playing'
         FROM b, rnd
       RETURNING id, status, track_id, device_id
     )
     SELECT ins.id, ins.status, t.video_id, t.title, t.artist, a.cover, (ins.device_id = '__auto__') AS is_auto
       FROM ins
       JOIN tracks t ON t.id = ins.track_id
       JOIN albums a ON a.id = t.album_id`,
  );
  return autoRows[0] ?? null;
}

export async function markPlayed(id: number) {
  await query(`UPDATE requests SET status = 'played', played_at = now() WHERE id = $1 AND status <> 'played'`, [id]);
}
