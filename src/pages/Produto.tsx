import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Lock, Play, FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

type Modulo = { id: string; titulo: string; descricao: string | null; ordem: number; aulas: Aula[] };
type Aula = { id: string; titulo: string; tipo: string; conteudo: string | null; duracao_min: number | null; ordem: number };
type Produto = { id: string; nome: string; descricao: string | null; cover_url: string | null; link_checkout: string | null; tipo: string };

function embedUrl(url: string) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  return url;
}

export default function Produto() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [produto, setProduto] = useState<Produto | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [temAcesso, setTemAcesso] = useState(false);
  const [loading, setLoading] = useState(true);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      if (!user || !id) return;
      const [{ data: prod }, { data: acesso }, { data: mods }, { data: aulas }] = await Promise.all([
        (supabase as any).from("clube_produtos").select("*").eq("id", id).single(),
        (supabase as any).from("clube_acessos").select("id").eq("user_id", user.id).eq("produto_id", id).eq("ativo", true).maybeSingle(),
        (supabase as any).from("clube_modulos").select("*").eq("produto_id", id).eq("ativo", true).order("ordem"),
        (supabase as any).from("clube_aulas").select("*").eq("ativo", true).order("ordem"),
      ]);
      if (!prod) { navigate("/"); return; }
      setProduto(prod);
      setTemAcesso(!!acesso);
      // Agrupa aulas por módulo
      const modsComAulas = (mods ?? []).map((m: any) => ({
        ...m,
        aulas: (aulas ?? []).filter((a: any) => a.modulo_id === m.id),
      }));
      setModulos(modsComAulas);
      // Abre primeiro módulo por padrão
      if (modsComAulas.length > 0) setAbertos(new Set([modsComAulas[0].id]));
      setLoading(false);
    };
    load();
  }, [user?.id, id]);

  const toggleModulo = (mid: string) =>
    setAbertos(prev => { const n = new Set(prev); n.has(mid) ? n.delete(mid) : n.add(mid); return n; });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!temAcesso && produto) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50 px-4">
      <div className="bg-white rounded-2xl border shadow-xl p-8 max-w-sm text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">{produto.nome}</h2>
        <p className="text-muted-foreground text-sm mb-6">Você ainda não tem acesso a este produto.</p>
        {produto.link_checkout && (
          <a href={produto.link_checkout} target="_blank" rel="noreferrer"
            className="block w-full py-3 rounded-xl font-semibold text-white bg-primary hover:opacity-90 transition-opacity mb-3">
            Quero ter acesso
          </a>
        )}
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-bold text-base truncate">{produto?.nome}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Módulos */}
        {modulos.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center text-muted-foreground">
            <p className="text-5xl mb-4">📂</p>
            <p className="font-semibold">Conteúdo em breve!</p>
            <p className="text-sm mt-1">Os módulos serão adicionados em breve.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {modulos.map((m, mi) => (
              <div key={m.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                {/* Header módulo */}
                <button
                  onClick={() => toggleModulo(m.id)}
                  className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {mi + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{m.titulo}</p>
                    {m.descricao && <p className="text-xs text-muted-foreground truncate">{m.descricao}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground mr-2">{m.aulas.length} aulas</span>
                  {abertos.has(m.id) ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </button>

                {/* Aulas */}
                {abertos.has(m.id) && (
                  <div className="border-t divide-y">
                    {m.aulas.map((a) => (
                      <AulaItem key={a.id} aula={a} />
                    ))}
                    {m.aulas.length === 0 && (
                      <p className="px-5 py-4 text-sm text-muted-foreground">Nenhuma aula neste módulo ainda.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AulaItem({ aula }: { aula: Aula }) {
  const [aberto, setAberto] = useState(false);
  const icon = aula.tipo === "video" ? <Play className="h-4 w-4 text-primary" />
    : aula.tipo === "pdf" ? <FileText className="h-4 w-4 text-amber-600" />
    : <ExternalLink className="h-4 w-4 text-blue-600" />;

  return (
    <div>
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
      >
        {icon}
        <span className="flex-1 text-sm">{aula.titulo}</span>
        {aula.duracao_min && <span className="text-xs text-muted-foreground">{aula.duracao_min}min</span>}
        {aberto ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {aberto && aula.conteudo && (
        <div className="px-5 pb-5">
          {aula.tipo === "video" ? (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <iframe
                src={embedUrl(aula.conteudo) ?? aula.conteudo}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          ) : aula.tipo === "pdf" ? (
            <a href={aula.conteudo} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors">
              <FileText className="h-4 w-4" /> Abrir PDF
            </a>
          ) : aula.tipo === "link" ? (
            <a href={aula.conteudo} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-blue-50 text-blue-800 text-sm font-medium hover:bg-blue-100 transition-colors">
              <ExternalLink className="h-4 w-4" /> Abrir link
            </a>
          ) : (
            <div className="text-sm text-foreground whitespace-pre-wrap bg-muted rounded-xl p-4">{aula.conteudo}</div>
          )}
        </div>
      )}
    </div>
  );
}
