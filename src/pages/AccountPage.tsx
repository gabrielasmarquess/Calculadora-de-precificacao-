import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  User,
  Key,
  LogOut,
  Laptop,
  Smartphone,
  Tablet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  Mail,
  ShieldAlert,
  KeyRound,
  RefreshCw,
  Globe,
  MapPin,
  Lock,
  Trash2,
} from 'lucide-react';
import { authService } from '../services/auth';
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
  const [activeTab, setActiveTab] = useState<'security' | 'profile'>('security');
  const [name, setName] = useState(currentUser.name);
  const [companyName, setCompanyName] = useState(currentUser.companyName || '');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(!!currentUser.twoFactorEnabled);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [showTokenTestModal, setShowTokenTestModal] = useState(false);
  const [testTokenCode, setTestTokenCode] = useState<string | null>(null);
  const [testTempToken, setTestTempToken] = useState<string | null>(null);
  const [userEnteredCode, setUserEnteredCode] = useState('');
  const [tokenVerificationResult, setTokenVerificationResult] = useState<string | null>(null);

  // Sessions and logs state
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Sensitive Action Modal
  const [sensitiveActionModal, setSensitiveActionModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });
  const [sensitiveActionCode, setSensitiveActionCode] = useState('');
  const [sensitiveTempToken, setSensitiveTempToken] = useState<string | null>(null);
  const [generatedSensitiveCode, setGeneratedSensitiveCode] = useState<string | null>(null);
  const [sensitiveActionError, setSensitiveActionError] = useState<string | null>(null);

  const loadSessionsAndLogs = async () => {
    setLoadingSessions(true);
    try {
      const [fetchedSessions, fetchedLogs] = await Promise.all([
        authService.getSessions(),
        authService.getLogs(),
      ]);
      setSessions(fetchedSessions);
      setLogs(fetchedLogs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSessionsAndLogs();
  }, [currentUser.id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await authService.updateProfile(name, companyName);
    if (res.success) {
      setSuccessMsg('Perfil atualizado com sucesso!');
      onProfileUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(res.error || 'Erro ao atualizar perfil.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMsg('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('A confirmação da senha não confere.');
      return;
    }

    const res = await authService.changePassword(newPassword);
    if (res.success) {
      setPasswordMsg('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
      loadSessionsAndLogs();
      setTimeout(() => setPasswordMsg(null), 3000);
    } else {
      setPasswordMsg(res.error || 'Erro ao alterar senha.');
    }
  };

  const handleToggle2FA = async (enable: boolean) => {
    setTwoFactorLoading(true);
    const res = await authService.toggle2FA(enable);
    if (res.success) {
      setTwoFactorEnabled(enable);
      onProfileUpdated();
      loadSessionsAndLogs();
      setSuccessMsg(
        enable
          ? 'Token adicional de entrada ativado com sucesso! Novos acessos exigirão código de verificação de uso único.'
          : 'Token adicional de entrada desativado.'
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    }
    setTwoFactorLoading(false);
  };

  const handleOpenTokenTest = async () => {
    setShowTokenTestModal(true);
    setUserEnteredCode('');
    setTokenVerificationResult(null);
    const res = await authService.generateActionCode();
    if (res.success && res.code && res.tempToken) {
      setTestTokenCode(res.code);
      setTestTempToken(res.tempToken);
    }
  };

  const handleVerifyTestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTempToken) return;

    const res = await authService.verifyActionCode(testTempToken, userEnteredCode);
    if (res.success) {
      setTokenVerificationResult('success');
      loadSessionsAndLogs();
    } else {
      setTokenVerificationResult('error');
    }
  };

  const promptSensitiveAction = async (title: string, description: string, action: () => void) => {
    setSensitiveActionError(null);
    setSensitiveActionCode('');
    const codeRes = await authService.generateActionCode();
    if (codeRes.success && codeRes.code && codeRes.tempToken) {
      setGeneratedSensitiveCode(codeRes.code);
      setSensitiveTempToken(codeRes.tempToken);
    }
    setSensitiveActionModal({
      isOpen: true,
      title,
      description,
      onConfirm: action,
    });
  };

  const handleConfirmSensitiveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensitiveTempToken) {
      sensitiveActionModal.onConfirm();
      setSensitiveActionModal({ isOpen: false, title: '', description: '', onConfirm: () => {} });
      return;
    }

    const res = await authService.verifyActionCode(sensitiveTempToken, sensitiveActionCode);
    if (res.success) {
      setSensitiveActionModal({ isOpen: false, title: '', description: '', onConfirm: () => {} });
      sensitiveActionModal.onConfirm();
    } else {
      setSensitiveActionError(res.error || 'Código de verificação incorreto ou expirado.');
    }
  };

  const handleTerminateSession = (sessionId: string, deviceName: string) => {
    promptSensitiveAction(
      'Encerrar Sessão Remota',
      `Confirme o encerramento da sessão no dispositivo "${deviceName}". O token do dispositivo será invalidado no servidor imediatamente.`,
      async () => {
        const res = await authService.terminateSession(sessionId);
        if (res.success) {
          loadSessionsAndLogs();
          setSuccessMsg(`Dispositivo "${deviceName}" desconectado com sucesso.`);
          setTimeout(() => setSuccessMsg(null), 3000);
        }
      }
    );
  };

  const handleTerminateOtherSessions = () => {
    promptSensitiveAction(
      'Encerrar Todas as Outras Sessões',
      'Deseja desconectar todas as outras sessões no servidor? Apenas o dispositivo atual continuará com acesso.',
      async () => {
        const res = await authService.terminateOtherSessions();
        if (res.success) {
          loadSessionsAndLogs();
          setSuccessMsg(`${res.terminatedCount || 0} sessões encerradas no servidor.`);
          setTimeout(() => setSuccessMsg(null), 3000);
        }
      }
    );
  };

  const getDeviceIcon = (deviceType: string) => {
    const lower = deviceType.toLowerCase();
    if (lower.includes('tablet') || lower.includes('ipad')) {
      return <Tablet className="w-5 h-5" />;
    }
    if (lower.includes('celular') || lower.includes('smart') || lower.includes('mobile')) {
      return <Smartphone className="w-5 h-5" />;
    }
    return <Laptop className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
            Segurança & Dispositivos Conectados
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Área de segurança restrita: tokens de entrada, controle de sessões ativas e isolamento de dados.
          </p>
        </div>

        {/* Tab switch */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'bg-white text-[#064E3B] shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Segurança e Dispositivos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-white text-[#064E3B] shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dados do Vendedor
          </button>
        </div>
      </div>

      {/* Security Privacy Notice */}
      <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex items-start gap-3 text-xs text-emerald-950">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Privacidade & Validação de Acesso no Servidor:</span> O acesso aos dados é restrito à conta autenticada via token de sessão. Conhecer a URL não permite visualizar registros sem credenciais validadas. Todos os dados são sincronizados com segurança na mesma base em nuvem compartilhada entre seus dispositivos autorizados.
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-100 text-[#064E3B] rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {activeTab === 'security' ? (
        <div className="space-y-6">
          {/* Card 1: Token Adicional de Entrada e 2FA */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#064E3B] flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Token Adicional de Entrada (Autenticação em Dois Fatores)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Exige código numérico de uso único validado no servidor a cada novo login.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenTokenTest}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Testar / Simular Token
                </button>

                <button
                  type="button"
                  disabled={twoFactorLoading}
                  onClick={() => handleToggle2FA(!twoFactorEnabled)}
                  className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs ${
                    twoFactorEnabled
                      ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  {twoFactorEnabled ? 'Desativar 2FA' : 'Ativar Token de Entrada'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 block">Status do Token</span>
                <div className="flex items-center gap-1.5 mt-1 font-bold">
                  {twoFactorEnabled ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-800">Proteção Ativa</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span className="text-slate-600">Desativado</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 block">Validade no Servidor</span>
                <span className="font-bold text-slate-900 mt-1 block">5 minutos</span>
                <span className="text-[10px] text-slate-400">Tokens expiram automaticamente</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 block">Proteção contra Reuso</span>
                <span className="font-bold text-emerald-800 mt-1 block">Código de Uso Único</span>
                <span className="text-[10px] text-slate-400">Impossível reutilizar token</span>
              </div>
            </div>
          </div>

          {/* Card 2: Painel Privado de Dispositivos Conectados */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Painel de Dispositivos Conectados
                  </h3>
                  <span className="text-[11px] font-mono bg-emerald-100 text-[#064E3B] font-bold px-2 py-0.5 rounded-full">
                    {sessions.length} ativo{sessions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Computadores, celulares e tablets atualmente autenticados com acesso à sua conta.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSessionsAndLogs}
                  title="Atualizar lista de dispositivos"
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleTerminateOtherSessions}
                  className="text-xs font-semibold text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                >
                  Encerrar Todas as Outras Sessões
                </button>
              </div>
            </div>

            {/* Device items list */}
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Nenhuma sessão registrada.
                </p>
              ) : (
                sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className={`p-4 rounded-xl border transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      sess.isCurrentSession
                        ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          sess.isCurrentSession
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {getDeviceIcon(sess.deviceType)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {sess.deviceType}
                          </span>
                          {sess.isCurrentSession && (
                            <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-md shadow-2xs">
                              Dispositivo atualmente em uso
                            </span>
                          )}
                        </div>

                        <p className="text-slate-600 font-medium">
                          {sess.browser} {sess.os ? `· ${sess.os}` : ''}
                        </p>

                        <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Início: {new Date(sess.loginTime).toLocaleString('pt-BR')}
                          </span>
                          {sess.lastActive && (
                            <span className="flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 text-emerald-600" />
                              Último acesso: {new Date(sess.lastActive).toLocaleTimeString('pt-BR')}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-600">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {sess.approxLocation || 'São Paulo, Brasil'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                      {sess.isCurrentSession ? (
                        <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100/70 px-2.5 py-1 rounded-lg">
                          Sessão Local Ativa
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTerminateSession(sess.id, `${sess.deviceType} (${sess.browser})`)}
                          className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Encerrar Sessão</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 3: Auditoria e Acessos Recentes */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Histórico Real de Acessos & Auditoria de Segurança
                </h3>
                <p className="text-xs text-slate-500">
                  Registro de logins, encerramentos de sessões e alterações validadas no servidor.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">
                  Nenhum registro de auditoria gravado.
                </p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="font-medium text-slate-800">{log.details}</span>
                        {log.device && (
                          <span className="text-[10px] text-slate-400 block">{log.device}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0 ml-2">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Profile & Password Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
              <User className="w-4 h-4 text-[#064E3B]" />
              <h3 className="text-sm font-bold text-slate-900">Dados Cadastrais</h3>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail da Conta</label>
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Identificador único sincronizado na nuvem.
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
                  placeholder="Ex: LucraiBR Vendas Online"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
              <Key className="w-4 h-4 text-[#064E3B]" />
              <h3 className="text-sm font-bold text-slate-900">Senha de Acesso</h3>
            </div>

            {passwordMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                {passwordMsg}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nova Senha</label>
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
                <label className="block font-semibold text-slate-700 mb-1">Confirmar Senha</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Digite novamente"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test / Simulation Token Modal */}
      {showTokenTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#064E3B] flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">Teste do Token de Entrada</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Validação de código único no servidor com expiração em 5 minutos.
              </p>
            </div>

            {testTokenCode && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">
                  Código de Uso Único Gerado:
                </span>
                <span className="font-mono text-2xl font-black text-emerald-950 tracking-widest block my-1">
                  {testTokenCode}
                </span>
                <span className="text-[10px] text-emerald-700">Expira em 5 minutos</span>
              </div>
            )}

            {tokenVerificationResult === 'success' && (
              <div className="p-3 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold text-center">
                Código validado com sucesso pelo servidor! Token consumido e invalidado para evitar repetição.
              </div>
            )}

            {tokenVerificationResult === 'error' && (
              <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-bold text-center border border-rose-200">
                Código incorreto ou já utilizado.
              </div>
            )}

            {tokenVerificationResult !== 'success' && (
              <form onSubmit={handleVerifyTestToken} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Digite o código para validar:
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={userEnteredCode}
                    onChange={(e) => setUserEnteredCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg font-mono font-bold tracking-widest py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  Validar Código no Servidor
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => setShowTokenTestModal(false)}
              className="w-full py-2 text-slate-600 hover:text-slate-900 font-semibold text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Sensitive Action Authorization Modal */}
      {sensitiveActionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">{sensitiveActionModal.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{sensitiveActionModal.description}</p>
            </div>

            {generatedSensitiveCode && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">
                  Código de Autorização Gerado:
                </span>
                <span className="font-mono text-xl font-black text-amber-950 tracking-widest block my-1">
                  {generatedSensitiveCode}
                </span>
                <span className="text-[10px] text-amber-700">Digite abaixo para confirmar</span>
              </div>
            )}

            {sensitiveActionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold text-center">
                {sensitiveActionError}
              </div>
            )}

            <form onSubmit={handleConfirmSensitiveAction} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Código de Confirmação:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="000000"
                  value={sensitiveActionCode}
                  onChange={(e) => setSensitiveActionCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-base font-mono font-bold tracking-widest py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setSensitiveActionModal({ isOpen: false, title: '', description: '', onConfirm: () => {} })
                  }
                  className="flex-1 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl shadow-xs"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
