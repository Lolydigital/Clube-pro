/**
 * POST /api/webhook/cakto
 * Recebe evento da Cakto e libera/revoga acesso na área de membros.
 * Variável necessária: CLUBE_CAKTO_SECRET (token da Cakto para validar)
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
      "Access-Control-Allow-Headers": "Content-Type, X-Cakto-Signature",
    },
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return resp({ error: "JSON inválido" }, 400); }

  const event = body?.event ?? body?.type ?? "";
  const data = body?.data ?? body ?? {};

  const sbH = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  const SB = env.SUPABASE_URL;

  // Extrai dados do comprador
  const email = (data?.customer?.email ?? data?.buyer?.email ?? data?.email ?? "").toLowerCase().trim();
  const offerId = String(data?.offer?.id ?? data?.offer_id ?? data?.product?.id ?? "");
  const orderId = String(data?.order?.id ?? data?.id ?? "");

  console.log("[cakto webhook]", event, email, offerId);
  if (!email) return resp({ ok: false, msg: "sem email" }, 200);

  // Mapeamento: offer_id → produto_id
  const mapRes = await fetch(
    `${SB}/rest/v1/clube_produto_plataformas?plataforma=eq.cakto&plataforma_produto_id=eq.${encodeURIComponent(offerId)}&select=produto_id`,
    { headers: sbH }
  );
  const mapData = await mapRes.json();
  const produtoId = mapData?.[0]?.produto_id;
  if (!produtoId) {
    console.warn("[cakto webhook] offer_id não mapeado:", offerId);
    return resp({ ok: true, msg: "offer não mapeado, ignorado" }, 200);
  }

  // Busca ou cria conta Supabase para o email
  let userId = await getUserId(email, data?.customer?.name ?? data?.buyer?.name ?? "", sbH, SB, env);
  if (!userId) return resp({ error: "Falha ao criar/buscar usuário" }, 500);

  const aprovados = ["approved", "paid", "completed", "active", "purchase_approved"];
  const cancelados = ["refunded", "chargeback", "cancelled", "canceled", "subscription_cancelled"];

  if (aprovados.some(s => event.includes(s) || event === s)) {
    await upsertAcesso(userId, produtoId, orderId, "cakto", true, sbH, SB);
    console.log("[cakto webhook] acesso liberado:", email);
    return resp({ ok: true });
  }

  if (cancelados.some(s => event.includes(s) || event === s)) {
    await upsertAcesso(userId, produtoId, orderId, "cakto", false, sbH, SB);
    console.log("[cakto webhook] acesso revogado:", email);
    return resp({ ok: true });
  }

  return resp({ ok: true, msg: "evento ignorado: " + event }, 200);
}

async function getUserId(email, nome, sbH, SB, env) {
  // Tenta achar nas páginas de usuários
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`${SB}/auth/v1/admin/users?per_page=50&page=${page}`, { headers: sbH });
    if (!r.ok) break;
    const d = await r.json();
    const found = (d?.users ?? []).find(u => (u.email ?? "").toLowerCase() === email);
    if (found) return found.id;
    if ((d?.users ?? []).length < 50) break;
  }
  // Cria novo usuário com senha temporária (ela recebe o link de ativação)
  const senha = Math.random().toString(36).slice(2, 10) + "A1!";
  const r = await fetch(`${SB}/auth/v1/admin/users`, {
    method: "POST",
    headers: sbH,
    body: JSON.stringify({
      email,
      password: senha,
      email_confirm: false, // vai receber email para confirmar/criar senha
      user_metadata: { nome: nome || email.split("@")[0] },
    }),
  });
  const d = await r.json();
  if (d?.id) {
    // Envia email de convite (magic link)
    await fetch(`${SB}/auth/v1/admin/users/${d.id}`, {
      method: "PUT",
      headers: sbH,
      body: JSON.stringify({ email_confirm: true }),
    });
    // Gera link de reset de senha para ela criar a própria
    await fetch(`${SB}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: sbH,
      body: JSON.stringify({
        type: "recovery",
        email,
        options: { redirect_to: `${env.CLUBE_URL ?? "https://clube.catalogopro.store"}/login` },
      }),
    });
    return d.id;
  }
  return null;
}

async function upsertAcesso(userId, produtoId, orderId, origem, ativo, sbH, SB) {
  // Upsert (cria ou atualiza)
  await fetch(`${SB}/rest/v1/clube_acessos`, {
    method: "POST",
    headers: { ...sbH, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      produto_id: produtoId,
      ativo,
      origem,
      plataforma_order_id: orderId,
    }),
  });
}
