import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  Users,
  Laptop,
  Smartphone,
  Tablet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Lock,
  Unlock,
  LogOut,
  Trash2,
  Search,
  Filter,
  Eye,
  X,
  MapPin,
  Activity,
} from 'lucide-react';
import { authService } from '../services/auth';
import { UserProfile, AdminUserListItem, AdminAuditLog } from '../types/finance';

interface AdminPageProps {
  currentUser: UserProfile;
}

export const AdminPage: React.FC<AdminPageProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserForSessions, setSelectedUserForSessions] = useState<AdminUserListItem | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = currentUser.role === 'admin';

  const fetchData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [userList, logs] = await Promise.all([
        authService.adminGetUsers(),
        authService.adminGetAuditLogs(),
      ]);
      setUsers(userList);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser.id]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handleToggleUserStatus = async (user: AdminUserListItem) => {
    const newStatus = user.status === 'blocked' ? 'active' : 'blocked';
    const confirmText =
      newStatus === 'blocked'
        ? `Tem certeza que deseja BLOQUEAR a conta de "${user.name}" (${user.email})? Todas as sessões ativas serão imediatamente encerradas.`
        : `Deseja REATIVAR o acesso da conta de "${user.name}" (${user.email})?`;

    if (!window.confirm(confirmText)) return;

    const res = await authService.adminSetUserStatus(user.id, newStatus);
    if (res.success) {
      showFeedback('success', res.message || `Status de ${user.email} atualizado para ${newStatus}.`);
      fetchData();
    } else {
      showFeedback('error', res.error || 'Erro ao alterar status da conta.');
    }
  };

  const handleTerminateAllUserSessions = async (user: AdminUserListItem) => {
    if (
      !window.confirm(
        `Desconectar todos os dispositivos conectados à conta de "${user.name}" (${user.email})?`
      )
    ) {
      return;
    }

    const res = await authService.adminTerminateUserSessions(user.id);
    if (res.success) {
      showFeedback('success', `${res.terminatedCount ?? 0} sessão(ões) encerrada(s) com sucesso.`);
      fetchData();
      if (selectedUserForSessions?.id === user.id) {
        setSelectedUserForSessions(null);
      }
    } else {
      showFeedback('error', res.error || 'Erro ao desconectar sessões.');
    }
  };

  const handleTerminateSpecificSession = async (sessionId: string) => {
    if (!window.confirm('Deseja revogar e invalidar esta sessão específica no servidor?')) return;

    const res = await authService.adminTerminateSession(sessionId);
    if (res.success) {
      showFeedback('success', 'Sessão revogada com sucesso no servidor.');
      fetchData();
      if (selectedUserForSessions) {
        setSelectedUserForSessions((prev) =>
          prev
            ? {
                ...prev,
                activeSessions: prev.activeSessions.filter((s) => s.id !== sessionId),
                activeSessionsCount: Math.max(0, prev.activeSessionsCount - 1),
              }
            : null
        );
      }
    } else {
      showFeedback('error', res.error || 'Erro ao revogar sessão.');
    }
  };

  // If not admin, block rendering
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white rounded-3xl border border-rose-200 text-center shadow-lg space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Acesso Restrito ao Administrador</h2>
        <p className="text-xs text-slate-600">
          Você está autenticado como <strong>{currentUser.email}</strong>, mas esta área requer
          permissões exclusivas de Administrador do Sistema.
        </p>
      </div>
    );
  }

  // Metrics
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const blockedUsers = users.filter((u) => u.status === 'blocked').length;
  const totalActiveSessions = users.reduce((acc, u) => acc + (u.activeSessionsCount || 0), 0);
  const totalFailedAttempts = users.reduce((acc, u) => acc + (u.failedLoginAttempts || 0), 0);

  // Filtered users
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.companyName && u.companyName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getDeviceIcon = (deviceType: string) => {
    const lower = deviceType.toLowerCase();
    if (lower.includes('tablet') || lower.includes('ipad')) return <Tablet className="w-4 h-4" />;
    if (lower.includes('celular') || lower.includes('smart') || lower.includes('mobile'))
      return <Smartphone className="w-4 h-4" />;
    return <Laptop className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-900 text-white flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
                Painel Administrativo
              </h1>
              <p className="text-xs text-slate-500">
                Gerenciamento global de contas, controle de sessões ativas e auditoria de segurança.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchData}
            title="Atualizar dados"
            className="p-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {actionMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          )}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Total de Contas</span>
          <span className="text-2xl font-black font-mono text-slate-900 mt-1 block">
            {totalUsers}
          </span>
          <span className="text-[10px] text-emerald-700 font-medium">
            {activeUsers} ativas · {blockedUsers} bloqueadas
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Dispositivos Conectados</span>
          <span className="text-2xl font-black font-mono text-emerald-800 mt-1 block">
            {totalActiveSessions}
          </span>
          <span className="text-[10px] text-slate-400">Sessões ativas no servidor</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Contas Bloqueadas</span>
          <span className={`text-2xl font-black font-mono mt-1 block ${blockedUsers > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {blockedUsers}
          </span>
          <span className="text-[10px] text-slate-400">Acesso suspenso pelo admin</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Tentativas Malsucedidas</span>
          <span className={`text-2xl font-black font-mono mt-1 block ${totalFailedAttempts > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {totalFailedAttempts}
          </span>
          <span className="text-[10px] text-slate-400">Bloqueio automático após 5 falhas</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 px-5 pt-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'border-emerald-700 text-emerald-900 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Contas & Dispositivos ({users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === 'audit'
                  ? 'border-emerald-700 text-emerald-900 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Auditoria do Sistema & Logs</span>
            </button>
          </div>

          {activeTab === 'users' && (
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar usuário por nome ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          )}
        </div>

        {/* Tab 1: Users Table */}
        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Usuário / Operação</th>
                  <th className="py-3 px-4">Função</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Criado Em</th>
                  <th className="py-3 px-4">Último Acesso</th>
                  <th className="py-3 px-4 text-center">Sessões Ativas</th>
                  <th className="py-3 px-4 text-right">Ações Administrativas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.id === currentUser.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#064E3B] font-bold text-xs flex items-center justify-center">
                              {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-2">
                                <span>{u.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded">
                                    Você
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">{u.email}</span>
                              {u.companyName && (
                                <span className="text-[10px] text-slate-400 block">{u.companyName}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                              <Shield className="w-3 h-3 text-emerald-700" />
                              <span>Administrador</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              Vendedor
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {u.status === 'blocked' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <Lock className="w-3 h-3 text-rose-600" />
                              <span>Bloqueado</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Ativo</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                          {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('pt-BR') : '—'}
                        </td>

                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedUserForSessions(u)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 font-bold text-xs cursor-pointer transition-colors"
                          >
                            <span>{u.activeSessionsCount}</span>
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {/* Block / Unblock action */}
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u)}
                                className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                                  u.status === 'blocked'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                }`}
                                title={u.status === 'blocked' ? 'Reativar conta' : 'Bloquear conta'}
                              >
                                {u.status === 'blocked' ? (
                                  <Unlock className="w-3.5 h-3.5" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            {/* Disconnect all user sessions */}
                            {u.activeSessionsCount > 0 && !isSelf && (
                              <button
                                type="button"
                                onClick={() => handleTerminateAllUserSessions(u)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                title="Desconectar todos os dispositivos desta conta"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Desconectar</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: System Audit Logs */}
        {activeTab === 'audit' && (
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto p-4 text-xs">
            {auditLogs.length === 0 ? (
              <p className="py-8 text-center text-slate-400">
                Nenhum registro de auditoria disponível no momento.
              </p>
            ) : (
              auditLogs.map((log) => {
                const isFailed = log.action === 'failed_login';
                const isBlocked = log.action === 'account_blocked';

                return (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isFailed
                            ? 'bg-rose-100 text-rose-700'
                            : isBlocked
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{log.details}</span>
                          {log.userEmail && (
                            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                              {log.userEmail}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                          {log.device && <span>Dispositivo: {log.device}</span>}
                          {log.ip && <span>IP: {log.ip}</span>}
                          <span className="capitalize">Ação: {log.action.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                    </div>

                    <span className="font-mono text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* User Connected Sessions Modal */}
      {selectedUserForSessions && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Dispositivos de {selectedUserForSessions.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedUserForSessions.email} · {selectedUserForSessions.activeSessionsCount} sessões ativas
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserForSessions(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 text-xs">
              {selectedUserForSessions.activeSessions.length === 0 ? (
                <p className="py-6 text-center text-slate-400">
                  Nenhum dispositivo ativo no momento para esta conta.
                </p>
              ) : (
                selectedUserForSessions.activeSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#064E3B] flex items-center justify-center shrink-0">
                        {getDeviceIcon(sess.deviceType)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">
                          {sess.deviceType} · {sess.browser}
                        </div>
                        <div className="text-[11px] text-slate-500 space-y-0.5 mt-0.5">
                          <div>Conectado em: {new Date(sess.loginTime).toLocaleString('pt-BR')}</div>
                          {sess.lastActive && (
                            <div>Última atividade: {new Date(sess.lastActive).toLocaleTimeString('pt-BR')}</div>
                          )}
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <MapPin className="w-3 h-3" />
                            <span>{sess.approxLocation}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTerminateSpecificSession(sess.id)}
                      className="px-2.5 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
                      title="Desconectar este dispositivo"
                    >
                      Revogar
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              {selectedUserForSessions.activeSessions.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleTerminateAllUserSessions(selectedUserForSessions)}
                  className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
                >
                  Desconectar Todos os Dispositivos
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedUserForSessions(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold ml-auto cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
