import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
    client = neon(process.env.DATABASE_URL);
  }
  return (await client.query(text, params)) as T[];
}
