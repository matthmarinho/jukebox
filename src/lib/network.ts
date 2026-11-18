import { query } from "./db";

let tableEnsured = false;

async function ensureSettingsTable() {
  if (tableEnsured) return;
  await query(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
  tableEnsured = true;
}

/**
 * Converte um IP (IPv4 ou IPv6) em um identificador de rede comparável:
 * - Loopback / LAN privada -> "local"
 * - IPv4 -> endereço completo "a.b.c.d"
 * - IPv6 -> prefixo /64 (4 primeiros blocos de 16 bits), que é compartilhado por todos os aparelhos no mesmo Wi-Fi
 */
export function normalizeNetworkToken(rawIp: string | null | undefined): string | null {
  if (!rawIp) return null;
  let ip = rawIp.split(",")[0].trim().toLowerCase();
  if (!ip) return null;

  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }

  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  ) {
    return "local";
  }

  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return ip;
  }

  // IPv6 -> expande "::" e extrai o prefixo /64 (4 primeiros hextetos)
  if (ip.includes(":")) {
    const zoneIdx = ip.indexOf("%");
    if (zoneIdx !== -1) ip = ip.slice(0, zoneIdx);

    const parts = ip.split("::");
    if (parts.length > 2) return ip;
    const left = parts[0] ? parts[0].split(":") : [];
    const right = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
    const missing = Math.max(0, 8 - (left.length + right.length));
    const full = [...left, ...Array(missing).fill("0"), ...right].map((h) => h.padStart(4, "0"));
    if (full.length >= 4) {
      return `v6:${full.slice(0, 4).join(":")}`;
    }
  }

  return ip;
}

export function getRequestIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

/**
 * Registra os identificadores de rede (IPv4 e/ou prefixo IPv6 /64) da barbearia a partir do /player.
 */
export async function updateBarbershopNetwork(req: Request, extraIps: (string | null | undefined)[] = []) {
  await ensureSettingsTable();
  const tokens = new Set<string>();

  const reqToken = normalizeNetworkToken(getRequestIp(req));
  if (reqToken) tokens.add(reqToken);

  for (const extra of extraIps) {
    const t = normalizeNetworkToken(extra);
    if (t) tokens.add(t);
  }

  if (tokens.size === 0) return;

  // Mantém os tokens anteriores caso o request atual traga apenas IPv4 e o anterior já tinha o IPv6 da mesma sessão
  const existing = await query<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'allowed_network'`,
  );
  if (existing[0]?.value) {
    try {
      const prev: string[] = JSON.parse(existing[0].value);
      for (const p of prev) {
        // Se mudou o IPv4, substitui o IPv4 antigo; se mudou o IPv6, substitui o IPv6 antigo
        const isV6 = p.startsWith("v6:");
        const hasNewSameType = [...tokens].some((n) => n.startsWith("v6:") === isV6 && n !== "local");
        if (!hasNewSameType && p !== "local") {
          tokens.add(p);
        }
      }
    } catch {
      // ignore
    }
  }

  await query(
    `INSERT INTO settings(key, value, updated_at)
     VALUES ('allowed_network', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify([...tokens])],
  );
}

/**
 * Verifica se a requisição do cliente vem da mesma rede Wi-Fi registrada pelo /player da barbearia.
 */
export async function isSameBarbershopNetwork(
  req: Request,
  clientExtraIps: (string | null | undefined)[] = [],
): Promise<boolean> {
  await ensureSettingsTable();
  const rows = await query<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'allowed_network'`,
  );
  // Se o /player ainda não registrou nenhuma rede no banco, libera por padrão
  if (!rows[0]?.value) return true;

  let allowed: string[] = [];
  try {
    allowed = JSON.parse(rows[0].value);
  } catch {
    return true;
  }
  if (allowed.length === 0) return true;

  const clientTokens = new Set<string>();
  const reqToken = normalizeNetworkToken(getRequestIp(req));
  if (reqToken) clientTokens.add(reqToken);

  for (const ip of clientExtraIps) {
    const t = normalizeNetworkToken(ip);
    if (t) clientTokens.add(t);
  }

  // Em ambiente local (localhost), sempre permite
  if (clientTokens.has("local") && allowed.includes("local")) return true;

  for (const t of clientTokens) {
    if (allowed.includes(t)) return true;
  }
  return false;
}
