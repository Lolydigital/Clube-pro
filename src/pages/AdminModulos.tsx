import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, Loader2, ChevronDown, ChevronRight, GripVertical, Video, FileText, Link2, AlignLeft } from "lucide-react";

type Produto = { id: string; nome: string };
type Modulo = { id: string; titulo: string; descricao: string | null; ordem: number; ativo: boolean; aulas?: Aula[] };
type Aula = { id: string; modulo_id: string; titulo: string; tipo: string; conteudo: string | null; duracao_min: number | null; ordem: number; ativo: boolean };

const TIPOS_AULA = [
  { value: "video", label: "Vídeo", icon: Video },
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "link", label: "Link", icon: Link2 },
  { value: "texto", label: "Texto", icon: AlignLeft },
];

export default function AdminModulos() {
  const { id: produtoId } = useParams<{ id: string }>();
  const [produto, setProduto] = useState<Produto | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  // Estado edição módulo
  const [editMod, setEditMod] = useState<Partial<Modulo> | null>(null);
  const [salvandoMod, setSalvandoMod] = useState(false);

  // Estado edição aula
  const [editAula, setEditAula] = useState<(Partial<Aula> & { _moduloId?: string }) | null>(null);
  const [salvandoAula, setSalvandoAula] = useState(false);

  const load = async () => {
    setLoading(true);

    const [{ data: prod }, { data: mods }] = await Promise.all([
      (supabase as any).from("clube_produtos").select("id,nome").eq("id", produtoId).single(),
      (supabase as any).from("clube_modulos").select("*").eq("produto_id", produtoId).order("ordem"),
    ]);

    if (prod) setProduto(prod);

    if (mods) {
      const { data: aulas } = await (supabase as any)
        .from("clube_aulas")
        .select("*")
        .in("modulo_id", (mods as Modulo[]).map(m => m.id))
        .order("ordem");

      const aulasByMod: Record<string, Aula[]> = {};
      (aulas ?? []).forEach((a: Aula) => {
        if (!aulasByMod[a.modulo_id]) aulasByMod[a.modulo_id] = [];
        aulasByMod[a.modulo_id].push(a);
      });

      setModulos((mods as Modulo[]).map(m => ({ ...m, aulas: aulasByMod[m.id] ?? [] })));
    }
    setLoading(false);
  };

  useEffect(() => { if (produtoId) load(); }, [produtoId]);

  const toggleExpand = (id: string) =>
    setExpandidos(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── MÓDULOS ──
  const salvarModulo = async () => {
    if (!editMod?.titulo?.trim()) return toast.error("Título obrigatório");
    setSalvandoMod(true);
    const payload = {
      produto_id: produtoId,
      titulo: editMod.titulo!.trim(),
      descricao: editMod.descricao?.trim() || null,
      ordem: editMod.ordem ?? modulos.length,
      ativo: editMod.ativo ?? true,
    };
    if (editMod.id) {
      await (supabase as any).from("clube_modulos").update(payload).eq("id", editMod.id);
      toast.success("Módulo atualizado!");
    } else {
      await (supabase as any).from("clube_modulos").insert(payload);
      toast.success("Módulo criado!");
    }
    setSalvandoMod(false);
    setEditMod(null);
    load();
  };

  const excluirModulo = async (id: string) => {
    if (!confirm("Excluir módulo e todas as aulas dentro dele?")) return;
    await (supabase as any).from("clube_modulos").delete().eq("id", id);
    toast.success("Módulo excluído.");
    load();
  };

  // ── AULAS ──
  const salvarAula = async () => {
    if (!editAula?.titulo?.trim()) return toast.error("Título obrigatório");
    if (!editAula._moduloId && !editAula.modulo_id) return toast.error("Módulo não identificado");
    setSalvandoAula(true);
    const moduloId = editAula.modulo_id ?? editAula._moduloId;
    const moduloAtual = modulos.find(m => m.id === moduloId);
    const payload = {
      modulo_id: moduloId,
      titulo: editAula.titulo!.trim(),
      tipo: editAula.tipo ?? "video",
      conteudo: editAula.conteudo?.trim() || null,
      duracao_min: editAula.duracao_min ?? null,
      ordem: editAula.ordem ?? (moduloAtual?.aulas?.length ?? 0),
      ativo: editAula.ativo ?? true,
    };
    if (editAula.id) {
      await (supabase as any).from("clube_aulas").update(payload).eq("id", editAula.id);
      toast.success("Aula atualizada!");
    } else {
      await (supabase as any).from("clube_aulas").insert(payload);
      toast.success("Aula criada!");
      // Garante que o módulo fica expandido
      setExpandidos(s => new Set([...s, moduloId!]));
    }
    setSalvandoAula(false);
    setEditAula(null);
    load();
  };

  const excluirAula = async (id: string) => {
    if (!confirm("Excluir esta aula?")) return;
    await (supabase as any).from("clube_aulas").delete().eq("id", id);
    toast.success("Aula excluída.");
    load();
  };

  const tipoIcon = (tipo: string) => {
    const t = TIPOS_AULA.find(t => t.value === tipo);
    return t ? <t.icon className="h-3.5 w-3.5" /> : null;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/admin" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Módulos e Aulas</p>
            <p className="font-bold text-base truncate">{produto?.nome ?? "Produto"}</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">
            {modulos.length} módulo{modulos.length !== 1 ? "s" : ""}
          </h2>
          <button
            onClick={() => setEditMod({ ativo: true, ordem: modulos.length })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Novo módulo
          </button>
        </div>

        {/* Form edição módulo */}
        {editMod && (
          <div className="bg-white rounded-2xl border shadow p-5 space-y-3">
            <h3 className="font-semibold text-sm">{editMod.id ? "Editar módulo" : "Novo módulo"}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium block mb-1">Título *</label>
                <input
                  value={editMod.titulo ?? ""}
                  onChange={e => setEditMod(m => ({ ...m!, titulo: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Módulo 1 — Fundamentos"
                  autoFocus
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium block mb-1">Descrição</label>
                <textarea
                  value={editMod.descricao ?? ""}
                  onChange={e => setEditMod(m => ({ ...m!, descricao: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Opcional — aparece para o membro"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Ordem</label>
                <input
                  type="number"
                  value={editMod.ordem ?? 0}
                  onChange={e => setEditMod(m => ({ ...m!, ordem: parseInt(e.target.value) || 0 }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="mod-ativo"
                  checked={editMod.ativo ?? true}
                  onChange={e => setEditMod(m => ({ ...m!, ativo: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="mod-ativo" className="text-sm">Ativo (visível para membros)</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={salvarModulo} disabled={salvandoMod} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-60">
                {salvandoMod ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar
              </button>
              <button onClick={() => setEditMod(null)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm">
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Form edição aula */}
        {editAula && (
          <div className="bg-white rounded-2xl border shadow p-5 space-y-3">
            <h3 className="font-semibold text-sm">{editAula.id ? "Editar aula" : "Nova aula"}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium block mb-1">Título *</label>
                <input
                  value={editAula.titulo ?? ""}
                  onChange={e => setEditAula(a => ({ ...a!, titulo: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Como criar seu catálogo"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Tipo</label>
                <div className="flex gap-2 flex-wrap">
                  {TIPOS_AULA.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setEditAula(a => ({ ...a!, tipo: t.value }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${(editAula.tipo ?? "video") === t.value ? "bg-primary text-white border-primary" : "hover:bg-muted"}`}
                    >
                      <t.icon className="h-3.5 w-3.5" /> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Duração (min)</label>
                <input
                  type="number"
                  value={editAula.duracao_min ?? ""}
                  onChange={e => setEditAula(a => ({ ...a!, duracao_min: parseInt(e.target.value) || null }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: 15"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium block mb-1">
                  {(editAula.tipo ?? "video") === "video" && "URL do vídeo (YouTube ou Vimeo)"}
                  {editAula.tipo === "pdf" && "URL do PDF"}
                  {editAula.tipo === "link" && "URL do link externo"}
                  {editAula.tipo === "texto" && "Conteúdo de texto"}
                </label>
                {editAula.tipo === "texto" ? (
                  <textarea
                    value={editAula.conteudo ?? ""}
                    onChange={e => setEditAula(a => ({ ...a!, conteudo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-none font-mono"
                    rows={5}
                    placeholder="Conteúdo da aula em texto..."
                  />
                ) : (
                  <input
                    value={editAula.conteudo ?? ""}
                    onChange={e => setEditAula(a => ({ ...a!, conteudo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder={
                      editAula.tipo === "video" ? "https://youtube.com/watch?v=..." :
                      editAula.tipo === "pdf" ? "https://..." :
                      "https://..."
                    }
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Ordem</label>
                <input
                  type="number"
                  value={editAula.ordem ?? 0}
                  onChange={e => setEditAula(a => ({ ...a!, ordem: parseInt(e.target.value) || 0 }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="aula-ativa"
                  checked={editAula.ativo ?? true}
                  onChange={e => setEditAula(a => ({ ...a!, ativo: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="aula-ativa" className="text-sm">Ativa (visível para membros)</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={salvarAula} disabled={salvandoAula} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-60">
                {salvandoAula ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar
              </button>
              <button onClick={() => setEditAula(null)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm">
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de módulos */}
        {modulos.length === 0 && !editMod && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">Nenhum módulo ainda.</p>
            <p className="text-xs mt-1">Clique em "Novo módulo" para começar.</p>
          </div>
        )}

        {modulos.map(mod => (
          <div key={mod.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            {/* Cabeçalho do módulo */}
            <div className="flex items-center gap-3 p-4">
              <button onClick={() => toggleExpand(mod.id)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                {expandidos.has(mod.id) ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(mod.id)}>
                <p className="font-semibold text-sm">{mod.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {mod.aulas?.length ?? 0} aula{(mod.aulas?.length ?? 0) !== 1 ? "s" : ""} · ordem {mod.ordem}
                  {!mod.ativo && " · ❌ inativo"}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => { setEditAula({ tipo: "video", ativo: true, _moduloId: mod.id, ordem: mod.aulas?.length ?? 0 }); setExpandidos(s => new Set([...s, mod.id])); }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs hover:bg-muted"
                  title="Adicionar aula"
                >
                  <Plus className="h-3.5 w-3.5" /> Aula
                </button>
                <button
                  onClick={() => setEditMod(mod)}
                  className="p-1.5 rounded-lg border hover:bg-muted"
                  title="Editar módulo"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => excluirModulo(mod.id)}
                  className="p-1.5 rounded-lg border hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                  title="Excluir módulo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Aulas do módulo (expandido) */}
            {expandidos.has(mod.id) && (
              <div className="border-t bg-slate-50">
                {(mod.aulas?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground px-6 py-3">Nenhuma aula. Clique em "+ Aula" para adicionar.</p>
                ) : (
                  <div className="divide-y">
                    {mod.aulas!.map(aula => (
                      <div key={aula.id} className="flex items-center gap-3 px-6 py-3">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                        <span className="text-muted-foreground flex-shrink-0">{tipoIcon(aula.tipo)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{aula.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {aula.tipo}
                            {aula.duracao_min ? ` · ${aula.duracao_min}min` : ""}
                            {aula.conteudo ? ` · ${aula.conteudo.slice(0, 40)}${aula.conteudo.length > 40 ? "…" : ""}` : ""}
                            {!aula.ativo && " · ❌ inativa"}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditAula({ ...aula, _moduloId: aula.modulo_id })}
                            className="p-1.5 rounded-lg border hover:bg-muted bg-white"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => excluirAula(aula.id)}
                            className="p-1.5 rounded-lg border hover:bg-red-50 hover:border-red-300 hover:text-red-600 bg-white"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
