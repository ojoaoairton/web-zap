import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Simulando delay para feedback visual
    setTimeout(() => {
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        sessionStorage.setItem('zf_authenticated', 'true');
        toast.success('Login realizado com sucesso!');
        navigate('/');
      } else {
        setError('E-mail ou senha incorretos');
        toast.error('Falha na autenticação');
      }
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f1a] p-4 text-slate-200">
      <div className="mb-8 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
          <MessageCircle className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white">ZaperFlux</h1>
        <p className="text-slate-400 font-medium">Painel Administrativo</p>
      </div>

      <Card className="w-full max-w-md border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-white">Bem-vindo de volta</CardTitle>
          <CardDescription className="text-center text-slate-400">
            Insira suas credenciais para acessar o construtor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">E-mail</label>
              <Input
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-primary/40 focus:border-primary/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-primary/40 focus:border-primary/40"
              />
            </div>

            {error && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center font-medium animate-in fade-in zoom-in duration-300">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-xs text-slate-600 font-medium">
        © {new Date().getFullYear()} ZaperFlux • Acesso Restrito
      </p>
    </div>
  );
};

export default LoginPage;
