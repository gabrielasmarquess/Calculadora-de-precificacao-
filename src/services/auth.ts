import { UserProfile } from '../types/finance';
import { logsRepo } from './db';

const AUTH_USER_KEY = 'lucraibr_auth_current_user';
const USERS_LIST_KEY = 'lucraibr_auth_registered_users';

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
  createdAt: new Date().toISOString(),
};

function getRegisteredUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(USERS_LIST_KEY);
    if (!raw) {
      const list = [DEFAULT_USER];
      localStorage.setItem(USERS_LIST_KEY, JSON.stringify(list));
      return list;
    }
    return JSON.parse(raw);
  } catch {
    return [DEFAULT_USER];
  }
}

export const authService = {
  getCurrentUser(): UserProfile {
    try {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      if (!raw) {
        // Log in default user on first visit for zero-friction experience
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(DEFAULT_USER));
        return DEFAULT_USER;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_USER;
    }
  },

  login(email: string): { success: boolean; error?: string } {
    const users = getRegisteredUsers();
    const found = users.find((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
    if (found) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(found));
      logsRepo.addLog(found.id, 'login', `Login realizado com sucesso no dispositivo (${navigator.platform || 'Web'})`);
      emitAuthChange(found);
      return { success: true };
    }
    return { success: false, error: 'Usuário não encontrado. Crie uma conta para continuar.' };
  },

  register(name: string, email: string, companyName?: string): { success: boolean; error?: string } {
    const users = getRegisteredUsers();
    const existing = users.find((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
    if (existing) {
      return { success: false, error: 'Este e-mail já está cadastrado.' };
    }

    const newUser: UserProfile = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      companyName: companyName?.trim() || 'Minha Operação Marketplace',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(users));
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    logsRepo.addLog(newUser.id, 'login', 'Nova conta registrada e logada');
    emitAuthChange(newUser);
    return { success: true };
  },

  logout(): void {
    const current = this.getCurrentUser();
    if (current) {
      logsRepo.addLog(current.id, 'logout', 'Encerramento de sessão voluntário');
    }
    localStorage.removeItem(AUTH_USER_KEY);
    emitAuthChange(null);
  },

  updateProfile(name: string, companyName?: string): void {
    const current = this.getCurrentUser();
    if (!current) return;
    const updated: UserProfile = {
      ...current,
      name: name.trim(),
      companyName: companyName?.trim() || current.companyName,
    };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));

    const users = getRegisteredUsers();
    const idx = users.findIndex((u) => u.id === current.id);
    if (idx >= 0) {
      users[idx] = updated;
      localStorage.setItem(USERS_LIST_KEY, JSON.stringify(users));
    }
    emitAuthChange(updated);
  },
};
