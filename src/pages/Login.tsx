import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ nome_plataforma: "Clube Pro", logo_url: "", banner_url: "", cor_primaria: "#7C3AED", frase_boas_vindas: "Bem-vinda! 🎉" });

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user]);

  useEffect(() => {
    (supabase as any).from("clube_config").select("*").single().then(({ data }: any) => {
      if (data) setConfig({ ...config, ...data });
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    setLoading(false);
    if (error) {
      if (error.message.includes("Invalid login")) toast.error("E-mail ou senha incorretos.");
      else toast.error(error.message);
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Digite seu e-mail.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Link enviado! Verifique seu e-mail.");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / nome */}
        <div className="text-center mb-8">
          {config.logo_url
            ? <img src={config.logo_url} alt={config.nome_plataforma} className="h-16 mx-auto mb-4 object-contain" />
            : (
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ background: config.cor_primaria }}>
                <span className="text-white font-black text-2xl">C</span>
              </div>
            )
          }
          <h1 className="text-2xl font-black text-foreground">{config.nome_plataforma}</h1>
          <p className="text-sm text-muted-foreground mt-1">Área exclusiva para membros</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border p-8">
          {mode === "login" ? (
            <>
              <h2 className="text-lg font-bold mb-6 text-center">Entrar na sua conta</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      required
                      className="w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showSenha ? "text" : "password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-10 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    />
                    <button type="button" onClick={() => setShowSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: config.cor_primaria }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>
              <button onClick={() => setMode("forgot")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-4 transition-colors">
                Esqueci minha senha
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold mb-2 text-center">Recuperar senha</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">Vamos enviar um link para você criar uma nova senha.</p>
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">E-mail cadastrado</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      required
                      className="w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: config.cor_primaria }}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Enviando..." : "Enviar link"}
                </button>
              </form>
              <button onClick={() => setMode("login")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-4">
                ← Voltar ao login
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Seus dados são protegidos conforme a LGPD.
        </p>
      </div>
    </div>
  );
}
