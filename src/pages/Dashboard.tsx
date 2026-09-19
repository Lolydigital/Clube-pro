import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, Unlock, ChevronRight, LogOut, Settings, ExternalLink } from "lucide-react";

type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  cover_url: string | null;
  link_vendas: string | null;
  link_checkout: string | null;
  tipo: string;
  ordem: number;
};

type Config = {
  nome_plataforma: string;
  logo_url: string | null;
  banner_url: string | null;
  cor_primaria: string;
  frase_boas_vindas: string;
};

export default function Dashboard() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [acessos, setAcessos] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<Config>({
    nome_plataforma: "Clube Pro", logo_url: null, banner_url: null,
    cor_primaria: "#7C3AED", frase_boas_vindas: "Bem-vinda! 🎉",
  });
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<"pt" | "en">("pt");

  const t = (pt: string, en: string) => lang === "pt" ? pt : en;

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const [{ data: prods }, { data: accs }, { data: cfg }] = await Promise.all([
        (supabase as any).from("clube_produtos").select("*").eq("ativo", true).order("ordem"),
        (supabase as any).from("clube_acessos").select("produto_id").eq("user_id", user.id).eq("ativo", true),
        (supabase as any).from("clube_config").select("*").single(),
      ]);
      setProdutos(prods ?? []);
      setAcessos(new Set((accs ?? []).map((a: any) => a.produto_id)));
      if (cfg) setConfig({ ...config, ...cfg });
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const desbloqueados = produtos.filter(p => acessos.has(p.id));
  const bloqueados = produtos.filter(p => !acessos.has(p.id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-white">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.logo_url
              ? <img src={config.logo_url} alt={config.nome_plataforma} className="h-9 object-contain" />
              : (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow" style={{ background: config.cor_primaria }}>
                  <span className="text-white font-black text-base">C</span>
                </div>
              )
            }
            <span className="font-bold text-base hidden sm:block">{config.nome_plataforma}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={() => setLang(l => l === "pt" ? "en" : "pt")}
              className="text-xs px-2.5 py-1 rounded-lg border bg-white hover:bg-muted transition-colors font-medium"
              title="Trocar idioma"
            >
              {lang === "pt" ? "🇧🇷 PT" : "🇺🇸 EN"}
            </button>

            {isAdmin && (
              <Link to="/admin" className="text-xs px-2.5 py-1 rounded-lg border bg-white hover:bg-muted transition-colors flex items-center gap-1">
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            <button onClick={handleSignOut} className="text-xs px-2.5 py-1 rounded-lg border bg-white hover:bg-muted transition-colors flex items-center gap-1 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("Sair", "Sign out")}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Banner + saudação */}
      {config.banner_url && (
        <div className="w-full max-h-40 overflow-hidden">
          <img src={config.banner_url} alt="Banner" className="w-full object-cover" />
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black">
            {t("Olá", "Hello")}, {user?.user_metadata?.nome ?? user?.email?.split("@")[0]}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">{config.frase_boas_vindas}</p>
        </div>

        {/* Produtos com acesso */}
        {desbloqueados.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
              <Unlock className="h-4 w-4 text-green-600" />
              {t("Meu acesso", "My access")} ({desbloqueados.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {desbloqueados.map(p => (
                <ProdutoCard key={p.id} produto={p} desbloqueado corPrimaria={config.cor_primaria} lang={lang} />
              ))}
            </div>
          </section>
        )}

        {/* Produtos bloqueados */}
        {bloqueados.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              {t("Disponível para comprar", "Available to purchase")} ({bloqueados.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {bloqueados.map(p => (
                <ProdutoCard key={p.id} produto={p} desbloqueado={false} corPrimaria={config.cor_primaria} lang={lang} />
              ))}
            </div>
          </section>
        )}

        {produtos.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <div className="text-5xl mb-4">🎓</div>
            <p className="text-lg font-semibold">{t("Nenhum produto disponível ainda.", "No products available yet.")}</p>
            <p className="text-sm mt-1">{t("Em breve novidades!", "More coming soon!")}</p>
          </div>
        )}
      </main>

      <footer className="border-t mt-16 py-6 text-center text-xs text-muted-foreground">
        {config.nome_plataforma} · {t("Todos os direitos reservados", "All rights reserved")} · LGPD
      </footer>
    </div>
  );
}

function ProdutoCard({ produto, desbloqueado, corPrimaria, lang }: { produto: Produto; desbloqueado: boolean; corPrimaria: string; lang: string }) {
  const t = (pt: string, en: string) => lang === "pt" ? pt : en;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md ${!desbloqueado ? "opacity-90" : ""}`}>
      {/* Cover */}
      <div className="relative aspect-video bg-gradient-to-br from-purple-100 to-indigo-100 overflow-hidden">
        {produto.cover_url
          ? <img src={produto.cover_url} alt={produto.nome} className="w-full h-full object-cover" />
          : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {produto.tipo === "ferramenta" ? "🛠️" : produto.tipo === "recurso" ? "📂" : "🎓"}
            </div>
          )
        }
        {/* Badge acesso */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${desbloqueado ? "bg-green-500 text-white" : "bg-black/60 text-white backdrop-blur-sm"}`}>
          {desbloqueado ? <><Unlock className="h-3 w-3" /> {t("Desbloqueado", "Unlocked")}</> : <><Lock className="h-3 w-3" /> {t("Bloqueado", "Locked")}</>}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          {produto.tipo === "ferramenta" ? t("Ferramenta", "Tool") : produto.tipo === "recurso" ? t("Recurso", "Resource") : t("Curso", "Course")}
        </p>
        <h3 className="font-bold text-base leading-tight mb-2">{produto.nome}</h3>
        {produto.descricao && <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{produto.descricao}</p>}

        <div className="mt-4">
          {desbloqueado ? (
            <Link
              to={`/produto/${produto.id}`}
              className="w-full py-2 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
              style={{ background: corPrimaria }}
            >
              {t("Acessar", "Access")} <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div className="space-y-2">
              {produto.link_checkout && (
                <a
                  href={produto.link_checkout}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5 hover:opacity-90"
                  style={{ background: corPrimaria }}
                >
                  {t("Quero ter acesso", "Get access")} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {produto.link_vendas && (
                <a
                  href={produto.link_vendas}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 rounded-xl text-sm font-medium border flex items-center justify-center gap-1.5 hover:bg-muted transition-colors"
                >
                  {t("Ver mais detalhes", "Learn more")} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
