let cached: { ipv4: string | null; ipv6: string | null; ts: number } | null = null;
const TTL_MS = 2 * 60 * 1000;

async function fetchIp(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: string };
    return data.ip ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getClientPublicIps() {
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return { ipv4: cached.ipv4, ipv6: cached.ipv6 };
  }
  const [ipv4, ipv6] = await Promise.all([
    fetchIp("https://api4.ipify.org?format=json"),
    fetchIp("https://api6.ipify.org?format=json"),
  ]);
  cached = { ipv4, ipv6, ts: Date.now() };
  return { ipv4, ipv6 };
}
