import React, { useState } from 'react';
import { Store, Lock, Mail, User, Building, ArrowRight, ShieldCheck, KeyRound, AlertCircle, Clock } from 'lucide-react';
import { authService } from '../../services/auth';

interface AuthModalProps {
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 2FA / Verification code step
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [codeHint, setCodeHint] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (requires2FA) {
        if (!twoFactorCode.trim() || twoFactorCode.trim().length !== 6) {
          setErrorMsg('Digite o código de verificação de 6 dígitos.');
          setLoading(false);
          return;
        }

        const res = await authService.verify2FA(tempToken, twoFactorCode.trim());
        if (res.success) {
          onSuccess();
        } else {
          setErrorMsg(res.error || 'Código incorreto ou expirado.');
        }
        setLoading(false);
        return;
      }

      if (isRegistering) {
        if (!name.trim() || !email.trim()) {
          setErrorMsg('Preencha seu nome e e-mail.');
          setLoading(false);
          return;
        }
        const res = await authService.register(name, email, companyName, password);
        if (res.success) {
          onSuccess();
        } else {
          setErrorMsg(res.error || 'Erro ao registrar conta.');
        }
      } else {
        if (!email.trim()) {
          setErrorMsg('Informe seu e-mail cadastrado.');
          setLoading(false);
          return;
        }
        const res = await authService.login(email, password);
        if (res.success) {
          if (res.requires2FA && res.tempToken) {
            setRequires2FA(true);
            setTempToken(res.tempToken);
            if (res.verificationCodeHint) {
              setCodeHint(res.verificationCodeHint);
            }
          } else {
            onSuccess();
          }
        } else {
          setErrorMsg(res.error || 'E-mail não encontrado.');
        }
      }
    } catch (err) {
      setErrorMsg('Falha na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#064E3B] text-white flex items-center justify-center mx-auto mb-3 shadow-md">
            {requires2FA ? <KeyRound className="w-6 h-6" /> : <Store className="w-6 h-6" />}
          </div>
          <h2 className="text-2xl font-extrabold text-[#064E3B] tracking-tight">
            {requires2FA ? 'Token de Segurança' : 'LucraiBR'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {requires2FA
              ? 'Digite o código de verificação de 6 dígitos gerado para sua conta'
              : 'Plataforma de Gestão Financeira & Precificação para Marketplaces'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {requires2FA ? (
          /* 2FA Verification Form */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {codeHint && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Código de uso único gerado pelo servidor:</span>
                </div>
                <p className="font-mono text-base font-extrabold text-emerald-950 tracking-widest text-center py-1">
                  {codeHint}
                </p>
                <p className="text-[10px] text-emerald-700 text-center">
                  Válido por 5 minutos · Uso único protegido contra repetição
                </p>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Código de 6 Dígitos
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-widest text-lg font-mono font-bold py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{loading ? 'Validando...' : 'Confirmar e Entrar'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setErrorMsg(null);
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Voltar ao login normal
            </button>
          </form>
        ) : (
          /* Normal Login / Register Form */
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {isRegistering && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Seu Nome Completo
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Gabriela Marques"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome da Operação / Loja (Opcional)
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ex: LucraiBR Vendas Online"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Seu E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Senha de Acesso (Opcional para a conta principal)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{loading ? 'Aguarde...' : isRegistering ? 'Criar Conta e Acessar' : 'Entrar na Plataforma'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {!requires2FA && (
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMsg(null);
              }}
              className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              {isRegistering
                ? 'Já tem uma conta? Clique aqui para Entrar'
                : 'Novo vendedor? Clique aqui para Criar Conta'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
