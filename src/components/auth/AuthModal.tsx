import React, { useState } from 'react';
import {
  Store,
  Lock,
  Mail,
  User,
  Building,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Key,
} from 'lucide-react';
import { authService } from '../../services/auth';

interface AuthModalProps {
  onSuccess: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot_password' | 'reset_password_code';

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [codeHint, setCodeHint] = useState<string | null>(null);

  // Password Recovery state
  const [resetToken, setResetToken] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryCodeHint, setRecoveryCodeHint] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      // 1. 2FA Step
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

      // 2. Forgot Password Request
      if (mode === 'forgot_password') {
        if (!email.trim()) {
          setErrorMsg('Informe o e-mail da conta.');
          setLoading(false);
          return;
        }

        const res = await authService.forgotPassword(email.trim());
        if (res.success && res.resetToken) {
          setResetToken(res.resetToken);
          setRecoveryCodeHint(res.codeHint || null);
          setMode('reset_password_code');
          setInfoMsg('Código de recuperação gerado. Digite o código e sua nova senha.');
        } else {
          setErrorMsg(res.error || 'Não foi possível solicitar a recuperação de senha.');
        }
        setLoading(false);
        return;
      }

      // 3. Reset Password Confirmation
      if (mode === 'reset_password_code') {
        if (!resetCode.trim() || resetCode.trim().length !== 6) {
          setErrorMsg('Digite o código de 6 dígitos.');
          setLoading(false);
          return;
        }
        if (!newPassword || newPassword.length < 6) {
          setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
          setLoading(false);
          return;
        }

        const res = await authService.resetPassword(resetToken, resetCode.trim(), newPassword);
        if (res.success) {
          setInfoMsg(res.message || 'Senha alterada com sucesso! Faça login com a nova senha.');
          setMode('login');
          setPassword('');
        } else {
          setErrorMsg(res.error || 'Erro ao redefinir senha.');
        }
        setLoading(false);
        return;
      }

      // 4. Registration
      if (mode === 'register') {
        if (!name.trim() || !email.trim()) {
          setErrorMsg('Preencha seu nome e e-mail.');
          setLoading(false);
          return;
        }
        if (password && password.length < 6) {
          setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
          setLoading(false);
          return;
        }
        const res = await authService.register(name, email, companyName, password);
        if (res.success) {
          onSuccess();
        } else {
          setErrorMsg(res.error || 'Erro ao registrar conta.');
        }
        setLoading(false);
        return;
      }

      // 5. Standard Login
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
        setErrorMsg(res.error || 'Credenciais inválidas ou e-mail não encontrado.');
      }
    } catch (err) {
      setErrorMsg('Falha na comunicação com o servidor de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setEmail('gabrielasousamarquess2@gmail.com');
    setPassword('lucraibr2026');
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#064E3B] text-white flex items-center justify-center mx-auto mb-3 shadow-md">
            {requires2FA ? (
              <KeyRound className="w-6 h-6" />
            ) : mode === 'forgot_password' || mode === 'reset_password_code' ? (
              <Key className="w-6 h-6" />
            ) : (
              <Store className="w-6 h-6" />
            )}
          </div>
          <h2 className="text-2xl font-extrabold text-[#064E3B] tracking-tight">
            {requires2FA
              ? 'Token de Segurança'
              : mode === 'forgot_password' || mode === 'reset_password_code'
              ? 'Recuperar Senha'
              : 'LucraiBR'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {requires2FA
              ? 'Digite o código de verificação de 6 dígitos gerado para sua conta'
              : mode === 'forgot_password'
              ? 'Informe seu e-mail para receber um código de uso único'
              : mode === 'reset_password_code'
              ? 'Crie uma nova senha de acesso para sua conta'
              : 'Plataforma de Gestão Financeira & Precificação para Marketplaces'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{infoMsg}</span>
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
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Voltar ao login normal
            </button>
          </form>
        ) : mode === 'forgot_password' ? (
          /* Forgot Password Request Form */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                E-mail cadastrado na conta
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{loading ? 'Solicitando...' : 'Enviar Código de Recuperação'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Voltar para a tela de login
            </button>
          </form>
        ) : mode === 'reset_password_code' ? (
          /* Reset Password Code & New Password Form */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {recoveryCodeHint && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Key className="w-4 h-4 text-amber-700" />
                  <span>Código de recuperação gerado:</span>
                </div>
                <p className="font-mono text-xl font-extrabold text-amber-950 tracking-widest text-center py-1">
                  {recoveryCodeHint}
                </p>
                <p className="text-[10px] text-amber-700 text-center">
                  Válido por 15 minutos no servidor
                </p>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Código de 6 Dígitos
              </label>
              <input
                type="text"
                maxLength={6}
                required
                placeholder="000000"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-widest text-lg font-mono font-bold py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nova Senha de Acesso (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Nova senha segura"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{loading ? 'Redefinindo...' : 'Salvar Nova Senha e Concluir'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Cancelar e voltar
            </button>
          </form>
        ) : (
          /* Normal Login / Register Form */
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {mode === 'register' && (
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
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Senha de Acesso
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="text-[11px] text-emerald-700 hover:underline cursor-pointer"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
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
              <span>
                {loading
                  ? 'Aguarde...'
                  : mode === 'register'
                  ? 'Criar Conta e Acessar'
                  : 'Entrar na Plataforma'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Quick Helper for Admin Demo */}
            {mode === 'login' && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Conta Administradora:</span>
                <button
                  type="button"
                  onClick={fillAdminCredentials}
                  className="font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Preencher dados de Gabriela Marques
                </button>
              </div>
            )}
          </form>
        )}

        {!requires2FA && mode !== 'forgot_password' && mode !== 'reset_password_code' && (
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'register' ? 'login' : 'register');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              {mode === 'register'
                ? 'Já tem uma conta? Clique aqui para Entrar'
                : 'Novo vendedor? Clique aqui para Criar Conta'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
