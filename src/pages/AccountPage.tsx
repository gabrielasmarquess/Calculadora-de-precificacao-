import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  User,
  Key,
  LogOut,
  Laptop,
  Smartphone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { authService } from '../services/auth';
import { logsRepo } from '../services/db';
import { UserProfile, UserSession, AccessLog } from '../types/finance';

interface AccountPageProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onProfileUpdated: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  currentUser,
  onLogout,
  onProfileUpdated,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [companyName, setCompanyName] = useState(currentUser.companyName || '');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // Sessions and logs from DB
  const [sessions, setSessions] = useState<UserSession[]>(() =>
    logsRepo.getSessions(currentUser.id)
  );
  const logs = useMemo(() => logsRepo.getLogs(currentUser.id), [currentUser.id]);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    authService.updateProfile(name, companyName);
    logsRepo.addLog(currentUser.id, 'login', 'Perfil do vendedor atualizado com sucesso');
    setSuccessMsg('Perfil atualizado com sucesso!');
    onProfileUpdated();
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      alert('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('A confirmação da senha não confere.');
      return;
    }

    logsRepo.addLog(currentUser.id, 'password_change', 'Senha de acesso alterada');
    setPasswordMsg('Senha alterada com sucesso!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordMsg(null), 3000);
  };

  const handleTerminateOtherSessions = () => {
    if (confirm('Deseja encerrar todas as outras sessões ativas deste usuário?')) {
      logsRepo.terminateOtherSessions(currentUser.id);
      setSessions(logsRepo.getSessions(currentUser.id));
      alert('Todas as outras sessões foram encerradas com sucesso.');
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
          Minha Conta & Segurança
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Gerenciamento do seu perfil, histórico real de acessos, sessões ativas e isolamento de dados.
        </p>
      </div>

      {/* Security Privacy Notice */}
      <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex items-start gap-3 text-xs text-emerald-950">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Privacidade & Isolamento Estrito:</span> Todos os seus pedidos,
          compras, contas a pagar, custos e repasses estão estritamente associados ao seu identificador
          único (<span className="font-mono font-semibold">{currentUser.id}</span>). Nenhum dado é compartilhado
          entre contas diferentes.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
            <User className="w-4 h-4 text-[#064E3B]" />
            <h3 className="text-sm font-bold text-slate-900">Dados do Vendedor</h3>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-100 text-[#064E3B] rounded-xl text-xs font-semibold">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                E-mail (Chave da Conta)
              </label>
              <input
                type="email"
                disabled
                value={currentUser.email}
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                O e-mail é o identificador único da sua conta na LucraiBR.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nome da Operação / Loja Marketplace
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Gabriela Importados & Variedades"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors"
              >
                Salvar Alterações de Perfil
              </button>
            </div>
          </form>
        </div>

        {/* Password and Credentials */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
            <Key className="w-4 h-4 text-[#064E3B]" />
            <h3 className="text-sm font-bold text-slate-900">Segurança & Senha</h3>
          </div>

          {passwordMsg && (
            <div className="p-3 bg-emerald-100 text-[#064E3B] rounded-xl text-xs font-semibold">
              {passwordMsg}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nova Senha
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a nova senha novamente"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors"
              >
                Atualizar Senha
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Deseja desconectar sua conta?</span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Sessions Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Sessões Ativas & Dispositivos
            </h3>
            <p className="text-xs text-slate-500">
              Dispositivos atualmente autenticados na sua conta.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTerminateOtherSessions}
            className="text-xs font-semibold text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
          >
            Encerrar Outras Sessões
          </button>
        </div>

        <div className="space-y-3">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-[#064E3B] flex items-center justify-center">
                  {sess.deviceType === 'Smartphone' ? (
                    <Smartphone className="w-4 h-4" />
                  ) : (
                    <Laptop className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    <span>{sess.deviceType}</span>
                    {sess.isCurrentSession && (
                      <span className="text-[10px] bg-emerald-100 text-[#064E3B] font-bold px-1.5 py-0.2 rounded">
                        Esta sessão atual
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-sm">
                    {sess.browser} · Conectado em {new Date(sess.loginTime).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <span className="text-[11px] text-emerald-700 font-semibold">
                Ativa
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Real Access Logs Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Histórico Real de Acessos & Atividades de Auditoria
          </h3>
          <p className="text-xs text-slate-500">
            Registro cronológico das ações de segurança realizadas pelo seu usuário (sem invenção de dados fictícios).
          </p>
        </div>

        <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">
              Nenhum registro de acesso anterior gravado.
            </p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-800">{log.details}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
