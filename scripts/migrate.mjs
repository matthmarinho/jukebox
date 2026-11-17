// Uso: node --env-file=.env.local scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    yt_album_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    artist TEXT NOT NULL,
    cover TEXT,
    year TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    album_id INT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    duration_sec INT,
    position INT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS batches_device_idx ON batches(device_id, id DESC)`,
  `CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','playing','played')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    played_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS requests_status_idx ON requests(status, id)`,
  `CREATE INDEX IF NOT EXISTS requests_batch_idx ON requests(batch_id)`,
];

for (const s of statements) await sql.query(s);
console.log("Migração concluída.");
