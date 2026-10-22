import { UserProfile, UserSession, AccessLog } from '../types/finance';
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

const DEFAULT_USER: UserProfile = {
  id: 'usr_owner_default',
  email: 'gabrielasousamarquess2@gmail.com',
  name: 'Gabriela Marques',
  companyName: 'LucraiBR Vendas Online',
  twoFactorEnabled: false,
  createdAt: new Date().toISOString(),
};

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
      // Auto-login default user for first load if no token exists
      const res = await this.login(DEFAULT_USER.email);
      if (res.success) {
        return this.getCurrentUser();
      }
      return null;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const user: UserProfile = data.user;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        emitAuthChange(user);
        return user;
      } else {
        // Session invalid or terminated remotely
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        emitAuthChange(null);
        return null;
      }
    } catch (err) {
      console.warn('Network check failed, falling back to cached user:', err);
      return this.getCurrentUser();
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
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Falha ao realizar login' };
      }

      if (data.requires2FA) {
        return {
          success: true,
          requires2FA: true,
          tempToken: data.tempToken,
          verificationCodeHint: data.verificationCodeHint,
          expiresInMinutes: data.expiresInMinutes,
        };
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      emitAuthChange(data.user);
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      // Offline fallback: if default user
      if (email.trim().toLowerCase() === DEFAULT_USER.email.toLowerCase()) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(DEFAULT_USER));
        emitAuthChange(DEFAULT_USER);
        return { success: true };
      }
      return { success: false, error: 'Erro de conexão com o servidor de autenticação.' };
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

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Código incorreto ou expirado' };
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      emitAuthChange(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Erro ao validar código no servidor.' };
    }
  },

  async register(
    name: string,
    email: string,
    companyName?: string,
    password?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, companyName, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Falha ao registrar conta' };
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      emitAuthChange(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Erro de conexão com o servidor.' };
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
    const updatedUser: UserProfile = {
      ...(current || DEFAULT_USER),
      name: name.trim(),
      companyName: companyName?.trim() || current?.companyName,
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
};
