/**
 * POST /api/admin/liberar-acesso
 * Libera acesso manualmente a um produto para um membro (usado no painel admin).
 * Body: { email, produto_id, origem }
 */
const resp = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
});

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return resp({ error: "JSON inválido" }, 400); }

  const { email, produto_id, origem = "manual" } = body ?? {};
  if (!email?.trim() || !produto_id) return resp({ error: "email e produto_id são obrigatórios" }, 400);

  const sbH = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  const SB = env.SUPABASE_URL;

  // Busca ou cria usuário
  let userId = null;
  for (let page = 1; page <= 10 && !userId; page++) {
    const r = await fetch(`${SB}/auth/v1/admin/users?per_page=50&page=${page}`, { headers: sbH });
    if (!r.ok) break;
    const d = await r.json();
    const found = (d?.users ?? []).find(u => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (found) userId = found.id;
    if ((d?.users ?? []).length < 50) break;
  }

  if (!userId) {
    // Cria conta nova e envia link de ativação
    const r = await fetch(`${SB}/auth/v1/admin/users`, {
      method: "POST",
      headers: sbH,
      body: JSON.stringify({
        email: email.toLowerCase(),
        password: Math.random().toString(36).slice(2, 10) + "A1!",
        email_confirm: true,
        user_metadata: { nome: email.split("@")[0] },
      }),
    });
    const d = await r.json();
    if (!d?.id) return resp({ error: "Não foi possível criar o usuário" }, 500);
    userId = d.id;
    // Envia link de criação de senha
    await fetch(`${SB}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: sbH,
      body: JSON.stringify({
        type: "recovery",
        email: email.toLowerCase(),
        options: { redirect_to: `${env.CLUBE_URL ?? "https://clube.catalogopro.store"}/login` },
      }),
    });
  }

  // Upsert acesso
  const r = await fetch(`${SB}/rest/v1/clube_acessos`, {
    method: "POST",
    headers: { ...sbH, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: userId, produto_id, ativo: true, origem }),
  });

  if (!r.ok) {
    const err = await r.text();
    return resp({ error: "Falha ao liberar acesso: " + err }, 500);
  }

  return resp({ ok: true, user_id: userId });
}
