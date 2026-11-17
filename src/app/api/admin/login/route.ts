import { checkPassword, createAdminSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!checkPassword(String(body?.password ?? ""))) {
    return Response.json({ error: "Senha incorreta." }, { status: 401 });
  }
  await createAdminSession();
  return Response.json({ ok: true });
}
