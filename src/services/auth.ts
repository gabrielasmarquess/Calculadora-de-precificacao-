import { UserProfile, UserSession, AccessLog, AdminUserListItem, AdminAuditLog } from '../types/finance';

export const DEFAULT_USER: UserProfile = {
  id: 'usr_owner_default',
  name: 'Gabriela Marques',
  email: 'gabrielasousamarquess2@gmail.com',
  companyName: 'LucraiBR Vendas Online',
  createdAt: '2026-10-21T00:51:29.038Z',
  role: 'admin',
  status: 'active',
  twoFactorEnabled: false,
};

const PROFILE_STORAGE_KEY = 'lucraibr_profile_data';

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

export const authService = {
  getToken(): string | null {
    return 'direct_access_mode';
  },

  getCurrentUser(): UserProfile {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return { ...DEFAULT_USER, ...parsed };
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_USER;
  },

  async checkServerSession(): Promise<UserProfile> {
    const user = this.getCurrentUser();
    emitAuthChange(user);
    return user;
  },

  async updateProfile(name: string, companyName?: string): Promise<{ success: boolean; user: UserProfile }> {
    const current = this.getCurrentUser();
    const updated: UserProfile = {
      ...current,
      name: name.trim() || current.name,
      companyName: companyName !== undefined ? companyName.trim() : current.companyName,
    };

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
      }
      // Also notify server in background if available
      fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: updated.name, companyName: updated.companyName }),
      }).catch(() => {});
    } catch (e) {
      console.warn('Profile save warning:', e);
    }

    emitAuthChange(updated);
    return { success: true, user: updated };
  },

  logout(): void {
    // Direct access mode: no blocking logout gate
    const user = this.getCurrentUser();
    emitAuthChange(user);
  },

  // Compatibility stubs so no legacy import fails
  async getSessions(): Promise<UserSession[]> {
    return [];
  },
  async getLogs(): Promise<AccessLog[]> {
    return [];
  },
  async changePassword(): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Configuração atualizada com sucesso.' };
  },
  async toggle2FA(): Promise<{ success: boolean }> {
    return { success: true };
  },
  async generateActionCode(): Promise<{ success: boolean; code?: string; tempToken?: string }> {
    return { success: true, code: '123456', tempToken: 'token' };
  },
  async verifyActionCode(): Promise<{ success: boolean }> {
    return { success: true };
  },
  async terminateSession(): Promise<{ success: boolean }> {
    return { success: true };
  },
  async terminateOtherSessions(): Promise<{ success: boolean }> {
    return { success: true };
  },
  async adminGetUsers(): Promise<AdminUserListItem[]> {
    return [];
  },
  async adminGetAuditLogs(): Promise<AdminAuditLog[]> {
    return [];
  },
  async adminSetUserStatus(): Promise<{ success: boolean }> {
    return { success: true };
  },
  async adminTerminateUserSessions(): Promise<{ success: boolean }> {
    return { success: true };
  },
  async adminTerminateSession(): Promise<{ success: boolean }> {
    return { success: true };
  },
};
