import { UserProfile, UserSession, AccessLog, AdminUserListItem, AdminAuditLog } from '../types/finance';
import { logsRepo } from './db';

const AUTH_USER_KEY = 'lucraibr_auth_current_user';
const AUTH_TOKEN_KEY = 'lucraibr_auth_session_token';

type AuthListener = (user: UserProfile | null) => void;
const authListeners: Set<AuthListener> = new Set();

function emitAuthChange(user: UserProfile | null) {
  authListeners.forEach((fn) => {
    try {
      fn(user);
    } catch (e) {
      console.error(e);
    }
  });
}

export function subscribeToAuth(callback: AuthListener): () => void {
  authListeners.add(callback);
  return () => {
    authListeners.delete(callback);
  };
}

interface SafeParsedResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  rawText: string;
}

async function parseResponseSafely<T = any>(res: Response): Promise<SafeParsedResponse<T>> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    rawText = '';
  }

  let data: T | null = null;
  const contentType = res.headers.get('content-type') || '';
  if (rawText && (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('['))) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  return { ok: res.ok, status: res.status, data, rawText };
}

function resolveErrorMessage(
  parsed: SafeParsedResponse,
  fallbackMessage: string
): string {
  if (parsed.data && typeof parsed.data === 'object') {
    if (parsed.data.error && typeof parsed.data.error === 'string') return parsed.data.error;
    if (parsed.data.message && typeof parsed.data.message === 'string') return parsed.data.message;
  }

  if (parsed.status === 404) {
    return 'Serviço de autenticação ou rota não encontrada (HTTP 404). É necessário publicar uma nova versão da aplicação.';
  }
  if (parsed.status === 429) {
    return 'Muitas tentativas de login. Conta temporariamente bloqueada por 15 minutos por segurança.';
  }
  if (parsed.status === 401) {
    return 'Credenciais de acesso incorretas ou sessão expirada no servidor.';
  }
  if (parsed.status === 403) {
    return 'Acesso negado ou conta suspensa pelo administrador (HTTP 403).';
  }
  if (parsed.status === 502 || parsed.status === 503 || parsed.status === 504) {
    return `O servidor backend está iniciando ou temporariamente indisponível (HTTP ${parsed.status}). Aguarde alguns instantes.`;
  }
  if (parsed.status >= 500) {
    return `Erro interno do servidor backend (HTTP ${parsed.status}).`;
  }

  return fallbackMessage;
}

export const authService = {
  getToken(): string | null {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  getCurrentUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async checkServerSession(): Promise<UserProfile | null> {
    const token = this.getToken();
    if (!token) {
      // No token -> User must authenticate via login/register
      emitAuthChange(null);
      return null;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const parsed = await parseResponseSafely<{ user: UserProfile }>(res);

      if (parsed.ok && parsed.data?.user) {
        const user: UserProfile = parsed.data.user;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        emitAuthChange(user);
        return user;
      } else {
        // Session invalid, revoked or blocked
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        emitAuthChange(null);
        return null;
      }
    } catch (err) {
      console.warn('Network check failed, using cached session if available:', err);
      const cached = this.getCurrentUser();
      emitAuthChange(cached);
      return cached;
    }
  },

  async login(
    email: string,
    password?: string
  ): Promise<{
    success: boolean;
    requires2FA?: boolean;
    tempToken?: string;
    verificationCodeHint?: string;
    expiresInMinutes?: number;
    error?: string;
  }> {
    const isMobile = typeof navigator !== 'undefined' && /mobile|iphone|ipod|android/i.test(navigator.userAgent);
    const isTablet = typeof navigator !== 'undefined' && /tablet|ipad/i.test(navigator.userAgent);
    const deviceType = isTablet ? 'Tablet' : isMobile ? 'Smartphone' : 'Computador';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceType }),
      });

      const parsed = await parseResponseSafely<{
        success?: boolean;
        token?: string;
        user?: UserProfile;
        requires2FA?: boolean;
        tempToken?: string;
        verificationCodeHint?: string;
        expiresInMinutes?: number;
        error?: string;
      }>(res);

      if (!parsed.ok || !parsed.data) {
        return {
          success: false,
          error: resolveErrorMessage(parsed, 'Falha ao realizar login no servidor.'),
        };
      }

      if (parsed.data.requires2FA) {
        return {
          success: true,
          requires2FA: true,
          tempToken: parsed.data.tempToken,
          verificationCodeHint: parsed.data.verificationCodeHint,
          expiresInMinutes: parsed.data.expiresInMinutes,
        };
      }

      if (parsed.data.token && parsed.data.user) {
        localStorage.setItem(AUTH_TOKEN_KEY, parsed.data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(parsed.data.user));
        emitAuthChange(parsed.data.user);
        return { success: true };
      }

      return { success: false, error: 'Resposta do servidor incompleta.' };
    } catch (err: any) {
      console.error('Login network error:', err);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      return {
        success: false,
        error: isOffline
          ? 'Sem conexão com a internet no celular. Verifique o sinal Wi-Fi ou dados móveis.'
          : `Erro de comunicação com o servidor: ${err?.message || 'Falha na rede'}.`,
      };
    }
  },

  async verify2FA(
    tempToken: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code }),
      });

      const parsed = await parseResponseSafely<{ token?: string; user?: UserProfile }>(res);
      if (!parsed.ok || !parsed.data) {
        return { success: false, error: resolveErrorMessage(parsed, 'Código incorreto ou expirado.') };
      }

      if (parsed.data.token && parsed.data.user) {
        localStorage.setItem(AUTH_TOKEN_KEY, parsed.data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(parsed.data.user));
        emitAuthChange(parsed.data.user);
        return { success: true };
      }

      return { success: false, error: 'Falha ao confirmar autenticação em duas etapas.' };
    } catch (err: any) {
      return { success: false, error: `Erro ao validar código no servidor: ${err?.message || 'Falha de rede'}` };
    }
  },

  async register(
    name: string,
    email: string,
    companyName?: string,
    password?: string
  ): Promise<{ success: boolean; error?: string }> {
    const isMobile = typeof navigator !== 'undefined' && /mobile|iphone|ipod|android/i.test(navigator.userAgent);
    const isTablet = typeof navigator !== 'undefined' && /tablet|ipad/i.test(navigator.userAgent);
    const deviceType = isTablet ? 'Tablet' : isMobile ? 'Smartphone' : 'Computador';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, companyName, password, deviceType }),
      });

      const parsed = await parseResponseSafely<{ token?: string; user?: UserProfile }>(res);
      if (!parsed.ok || !parsed.data) {
        return { success: false, error: resolveErrorMessage(parsed, 'Falha ao registrar conta.') };
      }

      if (parsed.data.token && parsed.data.user) {
        localStorage.setItem(AUTH_TOKEN_KEY, parsed.data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(parsed.data.user));
        emitAuthChange(parsed.data.user);
        return { success: true };
      }

      return { success: false, error: 'Registro não concluído com sucesso.' };
    } catch (err: any) {
      return { success: false, error: `Erro de comunicação ao registrar: ${err?.message || 'Falha de rede'}` };
    }
  },

  // Password Recovery - Request Reset Code
  async forgotPassword(email: string): Promise<{
    success: boolean;
    resetToken?: string;
    codeHint?: string;
    expiresInMinutes?: number;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const parsed = await parseResponseSafely<{
        resetToken?: string;
        codeHint?: string;
        expiresInMinutes?: number;
      }>(res);

      if (!parsed.ok || !parsed.data) {
        return { success: false, error: resolveErrorMessage(parsed, 'Erro ao solicitar recuperação.') };
      }

      return {
        success: true,
        resetToken: parsed.data.resetToken,
        codeHint: parsed.data.codeHint,
        expiresInMinutes: parsed.data.expiresInMinutes,
      };
    } catch (err: any) {
      return { success: false, error: `Erro de comunicação: ${err?.message || 'Falha de rede'}` };
    }
  },

  // Password Recovery - Submit New Password
  async resetPassword(
    resetToken: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, code, newPassword }),
      });

      const parsed = await parseResponseSafely<{ message?: string }>(res);
      if (!parsed.ok || !parsed.data) {
        return { success: false, error: resolveErrorMessage(parsed, 'Erro ao redefinir senha.') };
      }

      return { success: true, message: parsed.data.message };
    } catch (err: any) {
      return { success: false, error: `Erro de comunicação: ${err?.message || 'Falha de rede'}` };
    }
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    emitAuthChange(null);
  },

  async updateProfile(name: string, companyName?: string): Promise<{ success: boolean; error?: string }> {
    const token = this.getToken();
    const current = this.getCurrentUser();
    if (!current) return { success: false, error: 'Não autenticado' };

    const updatedUser: UserProfile = {
      ...current,
      name: name.trim(),
      companyName: companyName?.trim() || current.companyName,
    };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
    emitAuthChange(updatedUser);

    if (token) {
      try {
        await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name, companyName }),
        });
      } catch (err) {
        console.error('Failed to sync profile update:', err);
      }
    }

    return { success: true };
  },

  async changePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    const token = this.getToken();
    if (!token) return { success: false, error: 'Usuário não autenticado.' };

    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Erro ao alterar senha' };
      return { success: true };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  },

  async toggle2FA(enabled: boolean): Promise<{ success: boolean; error?: string }> {
    const token = this.getToken();
    if (!token) return { success: false, error: 'Usuário não autenticado.' };

    try {
      const res = await fetch('/api/auth/2fa/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Erro ao alterar 2FA' };

      const user = this.getCurrentUser();
      if (user) {
        user.twoFactorEnabled = enabled;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        emitAuthChange(user);
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  },

  async generateActionCode(): Promise<{
    success: boolean;
    tempToken?: string;
    code?: string;
    expiresInMinutes?: number;
    error?: string;
  }> {
    const token = this.getToken();
    if (!token) return { success: false, error: 'Não autenticado' };

    try {
      const res = await fetch('/api/auth/2fa/generate-code', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      return {
        success: true,
        tempToken: data.tempToken,
        code: data.code,
        expiresInMinutes: data.expiresInMinutes,
      };
    } catch {
      return { success: false, error: 'Erro de conexão.' };
    }
  },

  async verifyActionCode(tempToken: string, code: string): Promise<{ success: boolean; error?: string }> {
    const token = this.getToken();
    if (!token) return { success: false, error: 'Não autenticado' };

    try {
      const res = await fetch('/api/auth/2fa/verify-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tempToken, code }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Código inválido' };
      return { success: true };
    } catch {
      return { success: false, error: 'Erro ao validar código.' };
    }
  },

  async getSessions(): Promise<UserSession[]> {
    const token = this.getToken();
    if (!token) return [];

    try {
      const res = await fetch('/api/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.sessions || [];
      }
    } catch (err) {
      console.warn('Failed to fetch sessions from server:', err);
    }
    return logsRepo.getSessions(this.getCurrentUser()?.id || '');
  },

  async terminateSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const token = this.getToken();
    if (!token) return { success: false, error: 'Não autenticado' };

    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}/terminate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      return { success: true };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  },

  async terminateOtherSessions(): Promise<{ success: boolean; terminatedCount?: number; error?: string }> {
    const token = this.getToken();
    if (!token) return { success: false, error: 'Não autenticado' };

    try {
      const res = await fetch('/api/auth/sessions/terminate-others', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      return { success: true, terminatedCount: data.terminatedCount };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  },

  async getLogs(): Promise<AccessLog[]> {
    const token = this.getToken();
    if (!token) return [];

    try {
      const res = await fetch('/api/auth/logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch (err) {
      console.warn('Failed to fetch logs:', err);
    }
    return logsRepo.getLogs(this.getCurrentUser()?.id || '');
  },

  // ==========================================
  // ADMINISTRATOR METHODS (Protected on Server)
  // ==========================================
  async adminGetUsers(): Promise<AdminUserListItem[]> {
    const token = this.getToken();
    if (!token) return [];

    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.users || [];
      }
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
    }
    return [];
  },

  async adminSetUserStatus(
    userId: string,
    status: 'active' | 'blocked'
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const token = this.getToken();
    if (!token) return { success: false, error: 'Não autenticado como administrador.' };

    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const parsed = await parseResponseSafely<{ message?: string }>(res);
      if (!parsed.ok || !parsed.data) return { success: false, error: resolveErrorMessage(parsed, 'Erro ao alterar status.') };
      return { success: true, message: parsed.data.message };
    } catch (err: any) {
      return { success: false, error: `Erro de conexão: ${err?.message || 'Falha na rede'}` };
    }
  },

  async adminTerminateUserSessions(
    userId: string
  ): Promise<{ success: boolean; terminatedCount?: number; error?: string }> {
    const token = this.getToken();
    if (!token) return { success: false, error: 'Não autenticado como administrador.' };

    try {
      const res = await fetch(`/api/admin/users/${userId}/terminate-all-sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const parsed = await parseResponseSafely<{ terminatedCount?: number }>(res);
      if (!parsed.ok || !parsed.data) return { success: false, error: resolveErrorMessage(parsed, 'Erro ao desconectar sessões.') };
      return { success: true, terminatedCount: parsed.data.terminatedCount };
    } catch (err: any) {
      return { success: false, error: `Erro de conexão: ${err?.message || 'Falha na rede'}` };
    }
  },

  async adminTerminateSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const token = this.getToken();
    if (!token) return { success: false, error: 'Não autenticado como administrador.' };

    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/terminate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const parsed = await parseResponseSafely(res);
      if (!parsed.ok) return { success: false, error: resolveErrorMessage(parsed, 'Erro ao encerrar sessão.') };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Erro de conexão: ${err?.message || 'Falha na rede'}` };
    }
  },

  async adminGetAuditLogs(): Promise<AdminAuditLog[]> {
    const token = this.getToken();
    if (!token) return [];

    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch (err) {
      console.error('Failed to fetch admin audit logs:', err);
    }
    return [];
  },
};
