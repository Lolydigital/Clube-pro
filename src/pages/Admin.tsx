import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, Loader2, Users, Package, Settings, BookOpen, Link2 } from "lucide-react";

type Produto = { id: string; nome: string; descricao: string | null; cover_url: string | null; link_vendas: string | null; link_checkout: string | null; link_acesso: string | null; tipo: string; ordem: number; ativo: boolean };
type Membro = { user_id: string; email: string; produto_id: string; produto_nome: string; ativo: boolean; origem: string; created_at: string };
type Config = { id: string; nome_plataforma: string; logo_url: string | null; banner_url: string | null; cor_primaria: string; frase_boas_vindas: string; admin_user_ids: string[] };
type Tab = "produtos" | "membros" | "config" | "webhooks";

const TIPOS = ["curso", "ferramenta", "recurso"];

export default function Admin() {
  const [tab, setTab] = useState<Tab>("produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  // Form produto
  const [editProd, setEditProd] = useState<Partial<Produto> | null>(null);
  const [salvandoProd, setSalvandoProd] = useState(false);

  // Form membro manual
  const [addMembroEmail, setAddMembroEmail] = useState("");
  const [addMembroProdId, setAddMembroProdId] = useState("");
  const [addingMembro, setAddingMembro] = useState(false);

  // Config save
  const [savingConfig, setSavingConfig] = useState(false);
  const [cfgForm, setCfgForm] = useState<Partial<Config>>({});

  // Webhooks
  const [webhooks, setWebhooks] = useState<{ plataforma: string; url: string; chave: string }[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: prods }, { data: cfg }] = await Promise.all([
      (supabase as any).from("clube_produtos").select("*").order("ordem"),
      (supabase as any).from("clube_config").select("*").single(),
    ]);
    setProdutos(prods ?? []);
    if (cfg) { setConfig(cfg); setCfgForm(cfg); }

    // Membros com acesso
    const { data: accs } = await (supabase as any)
      .from("clube_acessos")
      .select("user_id, produto_id, ativo, origem, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (accs && prods) {
      const prodMap = Object.fromEntries((prods as Produto[]).map(p => [p.id, p.nome]));
      // Busca emails dos users
      const uids = [...new Set((accs as any[]).map((a: any) => a.user_id))];
      const enriched: Membro[] = (accs as any[]).map((a: any) => ({
        ...a,
        email: "(carregando...)",
        produto_nome: prodMap[a.produto_id] ?? a.produto_id,
      }));
      setMembros(enriched);
    }

    // Gera URLs de webhook para exibição
    const base = window.location.origin;
    setWebhooks([
      { plataforma: "Cakto", url: `${base}/api/webhook/cakto`, chave: "CLUBE_CAKTO_SECRET" },
      { plataforma: "Mercado Pago", url: `${base}/api/webhook/mp`, chave: "CLUBE_MP_SECRET" },
      { plataforma: "InfinitePay", url: `${base}/api/webhook/infinitepay`, chave: "CLUBE_INFINITEPAY_SECRET" },
    ]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Salvar produto
  const salvarProduto = async () => {
    if (!editProd?.nome?.trim()) return toast.error("Nome obrigatório");
    setSalvandoProd(true);
    const payload = {
      nome: editProd.nome!.trim(),
      descricao: editProd.descricao?.trim() || null,
      cover_url: editProd.cover_url?.trim() || null,
      link_vendas: editProd.link_vendas?.trim() || null,
      link_checkout: editProd.link_checkout?.trim() || null,
      link_acesso: editProd.link_acesso?.trim() || null,
      tipo: editProd.tipo ?? "curso",
      ordem: editProd.ordem ?? 0,
      ativo: editProd.ativo ?? true,
    };
    if (editProd.id) {
      await (supabase as any).from("clube_produtos").update(payload).eq("id", editProd.id);
      toast.success("Produto atualizado!");
    } else {
      await (supabase as any).from("clube_produtos").insert(payload);
      toast.success("Produto criado!");
    }
    setSalvandoProd(false);
    setEditProd(null);
    load();
  };

  // Salvar config
  const salvarConfig = async () => {
    if (!config?.id) return;
    setSavingConfig(true);
    await (supabase as any).from("clube_config").update({
      nome_plataforma: cfgForm.nome_plataforma,
      logo_url: cfgForm.logo_url?.trim() || null,
      banner_url: cfgForm.banner_url?.trim() || null,
      cor_primaria: cfgForm.cor_primaria,
      frase_boas_vindas: cfgForm.frase_boas_vindas,
    }).eq("id", config.id);
    setSavingConfig(false);
    toast.success("Configurações salvas!");
    load();
  };

  // Adicionar membro manualmente
  const addMembro = async () => {
    if (!addMembroEmail.trim() || !addMembroProdId) return toast.error("Preencha e-mail e produto");
    setAddingMembro(true);
    const res = await fetch("/api/admin/liberar-acesso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: addMembroEmail.trim().toLowerCase(), produto_id: addMembroProdId, origem: "manual" }),
    });
    const data = await res.json();
    setAddingMembro(false);
    if (!res.ok || !data.ok) toast.error(data.error ?? "Erro ao liberar acesso");
    else { toast.success("Acesso liberado!"); setAddMembroEmail(""); setAddMembroProdId(""); load(); }
  };

  // Revogar acesso
  const revogarAcesso = async (userId: string, produtoId: string) => {
    if (!confirm("Revogar acesso desta pessoa a este produto?")) return;
    await (supabase as any).from("clube_acessos").update({ ativo: false }).eq("user_id", userId).eq("produto_id", produtoId);
    toast.success("Acesso revogado.");
    load();
  };

  const tabBtn = (t: Tab, icon: React.ReactNode, label: string) => (
    <button onClick={() => setTab(t)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-primary text-white" : "hover:bg-muted"}`}>
      {icon} {label}
    </button>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="font-bold text-base">Painel Admin</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabBtn("produtos", <Package className="h-4 w-4" />, `Produtos (${produtos.length})`)}
          {tabBtn("membros", <Users className="h-4 w-4" />, `Membros (${membros.length})`)}
          {tabBtn("config", <Settings className="h-4 w-4" />, "Configurações")}
          {tabBtn("webhooks", <Link2 className="h-4 w-4" />, "Webhooks")}
        </div>

        {/* ── PRODUTOS ── */}
        {tab === "produtos" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Produtos da plataforma</h2>
              <button onClick={() => setEditProd({ ativo: true, tipo: "curso", ordem: produtos.length })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium">
                <Plus className="h-4 w-4" /> Novo produto
              </button>
            </div>

            {/* Form de edição */}
            {editProd && (
              <div className="bg-white rounded-2xl border shadow p-5 space-y-3">
                <h3 className="font-semibold">{editProd.id ? "Editar produto" : "Novo produto"}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium block mb-1">Nome *</label>
                    <input value={editProd.nome ?? ""} onChange={e => setEditProd(p => ({ ...p!, nome: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: Vitrine Pro" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Tipo</label>
                    <select value={editProd.tipo ?? "curso"} onChange={e => setEditProd(p => ({ ...p!, tipo: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium block mb-1">Descrição</label>
                    <textarea value={editProd.descricao ?? ""} onChange={e => setEditProd(p => ({ ...p!, descricao: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">URL da capa (imagem)</label>
                    <input value={editProd.cover_url ?? ""} onChange={e => setEditProd(p => ({ ...p!, cover_url: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Link página de vendas</label>
                    <input value={editProd.link_vendas ?? ""} onChange={e => setEditProd(p => ({ ...p!, link_vendas: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Link direto do checkout</label>
                    <input value={editProd.link_checkout ?? ""} onChange={e => setEditProd(p => ({ ...p!, link_checkout: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium block mb-1">🔓 Link de acesso (após comprar)</label>
                    <input value={editProd.link_acesso ?? ""} onChange={e => setEditProd(p => ({ ...p!, link_acesso: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: https://catalogopro.store" />
                    <p className="text-[11px] text-muted-foreground mt-1">URL que o membro acessa após desbloquear o produto</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Ordem</label>
                    <input type="number" value={editProd.ordem ?? 0} onChange={e => setEditProd(p => ({ ...p!, ordem: parseInt(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Ativo</label>
                  <input type="checkbox" checked={editProd.ativo ?? true} onChange={e => setEditProd(p => ({ ...p!, ativo: e.target.checked }))} className="rounded" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={salvarProduto} disabled={salvandoProd} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-60">
                    {salvandoProd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar
                  </button>
                  <button onClick={() => setEditProd(null)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm">
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Lista produtos */}
            <div className="space-y-2">
              {produtos.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4">
                  {p.cover_url && <img src={p.cover_url} alt={p.nome} className="w-14 h-14 object-cover rounded-xl flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.tipo} · ordem {p.ordem} · {p.ativo ? "✅ ativo" : "❌ inativo"}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Link to={`/admin/modulos/${p.id}`} className="p-2 rounded-lg border text-xs hover:bg-muted flex items-center gap-1" title="Gerenciar módulos">
                      <BookOpen className="h-3.5 w-3.5" />
                    </Link>
                    <button onClick={() => setEditProd(p)} className="p-2 rounded-lg border hover:bg-muted">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MEMBROS ── */}
        {tab === "membros" && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg">Gerenciar Membros</h2>

            {/* Adicionar manualmente */}
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <h3 className="font-semibold text-sm mb-3">Liberar acesso manualmente</h3>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">E-mail do membro</label>
                  <input value={addMembroEmail} onChange={e => setAddMembroEmail(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-60" placeholder="email@exemplo.com" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Produto</label>
                  <select value={addMembroProdId} onChange={e => setAddMembroProdId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                    <option value="">Selecionar produto</option>
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <button onClick={addMembro} disabled={addingMembro} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-60">
                  {addingMembro ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Liberar
                </button>
              </div>
            </div>

            {/* Lista acessos */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Usuário</th>
                      <th className="px-4 py-3 text-left">Produto</th>
                      <th className="px-4 py-3 text-left">Origem</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {membros.map((m, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono text-xs truncate max-w-[160px]">{m.user_id.slice(0, 8)}…</td>
                        <td className="px-4 py-3">{m.produto_nome}</td>
                        <td className="px-4 py-3"><span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{m.origem}</span></td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {m.ativo ? "ativo" : "revogado"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {m.ativo && (
                            <button onClick={() => revogarAcesso(m.user_id, m.produto_id)} className="text-destructive hover:opacity-70">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {membros.length === 0 && <p className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhum membro ainda.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIG ── */}
        {tab === "config" && cfgForm && (
          <div className="max-w-xl space-y-4">
            <h2 className="font-bold text-lg">Configurações visuais</h2>
            <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Nome da plataforma</label>
                <input value={cfgForm.nome_plataforma ?? ""} onChange={e => setCfgForm(c => ({ ...c, nome_plataforma: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">URL da logo</label>
                <input value={cfgForm.logo_url ?? ""} onChange={e => setCfgForm(c => ({ ...c, logo_url: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
                {cfgForm.logo_url && <img src={cfgForm.logo_url} alt="logo" className="h-10 mt-2 object-contain" />}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">URL do banner (topo)</label>
                <input value={cfgForm.banner_url ?? ""} onChange={e => setCfgForm(c => ({ ...c, banner_url: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
                {cfgForm.banner_url && <img src={cfgForm.banner_url} alt="banner" className="w-full max-h-24 object-cover rounded-xl mt-2" />}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Cor principal</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={cfgForm.cor_primaria ?? "#7C3AED"} onChange={e => setCfgForm(c => ({ ...c, cor_primaria: e.target.value }))} className="w-10 h-10 rounded-lg border cursor-pointer" />
                  <input value={cfgForm.cor_primaria ?? ""} onChange={e => setCfgForm(c => ({ ...c, cor_primaria: e.target.value }))} className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" placeholder="#7C3AED" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Frase de boas-vindas</label>
                <input value={cfgForm.frase_boas_vindas ?? ""} onChange={e => setCfgForm(c => ({ ...c, frase_boas_vindas: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={salvarConfig} disabled={savingConfig} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm disabled:opacity-60">
                {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar configurações
              </button>
            </div>
          </div>
        )}

        {/* ── WEBHOOKS ── */}
        {tab === "webhooks" && (
          <div className="max-w-2xl space-y-4">
            <h2 className="font-bold text-lg">URLs dos Webhooks</h2>
            <p className="text-sm text-muted-foreground">Cole cada URL abaixo no respectivo gateway de pagamento. Quando uma compra for aprovada, o acesso é liberado automaticamente.</p>
            <div className="space-y-3">
              {webhooks.map(w => (
                <div key={w.plataforma} className="bg-white rounded-2xl border shadow-sm p-5">
                  <p className="font-semibold text-sm mb-3">{w.plataforma}</p>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">URL do webhook</label>
                    <div className="flex items-center gap-2">
                      <input readOnly value={w.url} className="flex-1 border rounded-lg px-3 py-2 text-xs font-mono bg-muted" />
                      <button onClick={() => { navigator.clipboard.writeText(w.url); toast.success("Copiado!"); }} className="px-3 py-2 rounded-lg border text-xs hover:bg-muted font-medium">Copiar</button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Variável de ambiente necessária: <code className="bg-muted px-1 py-0.5 rounded font-mono">{w.chave}</code>
                  </p>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              Configure as variáveis de ambiente no painel do Cloudflare Pages → Settings → Environment variables.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
