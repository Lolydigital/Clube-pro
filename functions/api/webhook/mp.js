/**
 * POST /api/webhook/mp
 * Recebe notificação do Mercado Pago e libera/revoga acesso.
 * Variável necessária: CLUBE_MP_SECRET (access_token do vendedor)
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

  const type = body?.type ?? body?.action ?? "";
  const dataId = body?.data?.id ?? body?.id;

  if (!type.includes("payment") || !dataId) return resp({ ok: true, msg: "ignorado" }, 200);

  // Busca detalhes do pagamento no MP
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${env.CLUBE_MP_SECRET}` },
  });
  if (!mpRes.ok) return resp({ error: "Falha ao buscar pagamento MP" }, 502);
  const p = await mpRes.json();

  const email = (p?.payer?.email ?? "").toLowerCase().trim();
  const externalRef = String(p?.external_reference ?? ""); // deve ser o produto_id
  const status = p?.status ?? "";

  const sbH = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  const SB = env.SUPABASE_URL;

  if (!email || !externalRef) return resp({ ok: true, msg: "dados insuficientes" }, 200);

  const mapRes = await fetch(
    `${SB}/rest/v1/clube_produto_plataformas?plataforma=eq.mp&plataforma_produto_id=eq.${encodeURIComponent(externalRef)}&select=produto_id`,
    { headers: sbH }
  );
  const mapData = await mapRes.json();
  const produtoId = mapData?.[0]?.produto_id ?? externalRef;

  const userId = await getUserIdSimple(email, sbH, SB, env);
  if (!userId) return resp({ error: "Falha ao buscar/criar usuário" }, 500);

  if (status === "approved") {
    await upsertAcesso(userId, produtoId, String(dataId), "mp", true, sbH, SB);
    return resp({ ok: true });
  }
  if (["refunded", "charged_back", "cancelled"].includes(status)) {
    await upsertAcesso(userId, produtoId, String(dataId), "mp", false, sbH, SB);
    return resp({ ok: true });
  }
  return resp({ ok: true, msg: "status ignorado: " + status }, 200);
}

async function getUserIdSimple(email, sbH, SB, env) {
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`${SB}/auth/v1/admin/users?per_page=50&page=${page}`, { headers: sbH });
    if (!r.ok) break;
    const d = await r.json();
    const found = (d?.users ?? []).find(u => (u.email ?? "").toLowerCase() === email);
    if (found) return found.id;
    if ((d?.users ?? []).length < 50) break;
  }
  const senha = Math.random().toString(36).slice(2, 10) + "A1!";
  const r = await fetch(`${SB}/auth/v1/admin/users`, {
    method: "POST",
    headers: sbH,
    body: JSON.stringify({ email, password: senha, email_confirm: true, user_metadata: { nome: email.split("@")[0] } }),
  });
  const d = await r.json();
  if (d?.id) {
    await fetch(`${SB}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: sbH,
      body: JSON.stringify({ type: "recovery", email, options: { redirect_to: `${env.CLUBE_URL ?? "https://clube.catalogopro.store"}/login` } }),
    });
    return d.id;
  }
  return null;
}

async function upsertAcesso(userId, produtoId, orderId, origem, ativo, sbH, SB) {
  await fetch(`${SB}/rest/v1/clube_acessos`, {
    method: "POST",
    headers: { ...sbH, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: userId, produto_id: produtoId, ativo, origem, plataforma_order_id: orderId }),
  });
}
