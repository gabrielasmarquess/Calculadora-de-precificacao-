import React, { useState } from 'react';
import { Store, Lock, Mail, User, Building, ArrowRight } from 'lucide-react';
import { authService } from '../../services/auth';

interface AuthModalProps {
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isRegistering) {
      if (!name.trim() || !email.trim()) {
        setErrorMsg('Preencha seu nome e e-mail.');
        return;
      }
      const res = authService.register(name, email, companyName);
      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || 'Erro ao registrar conta.');
      }
    } else {
      if (!email.trim()) {
        setErrorMsg('Informe seu e-mail cadastrado.');
        return;
      }
      const res = authService.login(email);
      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || 'E-mail não encontrado.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#064E3B] text-white flex items-center justify-center mx-auto mb-3 shadow-md">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#064E3B] tracking-tight">
            LucraiBR
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Plataforma de Gestão Financeira & Precificação para Marketplaces
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

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

          <button
            type="submit"
            className="w-full mt-2 py-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{isRegistering ? 'Criar Conta e Acessar' : 'Entrar na Plataforma'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMsg(null);
            }}
            className="text-xs font-semibold text-emerald-800 hover:underline"
          >
            {isRegistering
              ? 'Já tem uma conta? Clique aqui para Entrar'
              : 'Novo na LucraiBR? Criar uma nova conta de vendedor'}
          </button>
        </div>
      </div>
    </div>
  );
};
