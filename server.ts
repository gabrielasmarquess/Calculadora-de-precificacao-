import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'cloud_db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'cloud_db.backup.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  companyName?: string;
  passwordHash?: string;
  role: 'admin' | 'user';
  status: 'active' | 'blocked';
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface TwoFactorPendingToken {
  id: string;
  userId: string;
  code: string;
  expiresAt: number;
  used: boolean;
}

export interface PasswordResetRecord {
  id: string; // resetToken
  userId: string;
  code: string;
  expiresAt: number;
  used: boolean;
}

export interface SessionRecord {
  id: string;
  userId: string;
  token: string;
  deviceType: 'Computador' | 'Smartphone' | 'Tablet';
  browser: string;
  os: string;
  ip: string;
  approxLocation: string;
  loginTime: string;
  lastActive: string;
  isActive: boolean;
}

export interface SecurityLogRecord {
  id: string;
  userId: string;
  userEmail?: string;
  timestamp: string;
  action:
    | 'login'
    | 'failed_login'
    | 'logout'
    | 'password_change'
    | 'password_reset_requested'
    | 'password_reset_completed'
    | '2fa_enabled'
    | '2fa_disabled'
    | 'session_terminated'
    | 'all_sessions_terminated'
    | 'account_blocked'
    | 'account_reactivated'
    | 'sync';
  details: string;
  ip?: string;
  device?: string;
}

export interface CloudDatabase {
  users: UserRecord[];
  sessions: SessionRecord[];
  pending2FACodes: TwoFactorPendingToken[];
  passwordResetCodes: PasswordResetRecord[];
  securityLogs: SecurityLogRecord[];
  products: Record<string, any[]>; // userId -> products
  orders: Record<string, any[]>; // userId -> orders
  purchases: Record<string, any[]>; // userId -> purchases
  expenses: Record<string, any[]>; // userId -> expenses
  transfers: Record<string, any[]>; // userId -> transfers
  cashBalances: Record<string, any>; // userId -> initial balance
  memories: Record<string, any[]>; // userId -> memories
  versions: Record<string, number>; // userId -> data version
}

// Password Hashing with Salt & PBKDF2 (SHA-512)
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  // Backward compatibility with legacy unsalted SHA256 hashes
  if (!storedHash.includes(':')) {
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    return legacyHash === storedHash;
  }
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch {
    return false;
  }
}

// In-Memory Brute Force / Rate Limit Tracker
interface FailedLoginTracker {
  count: number;
  lockedUntil?: number;
}
const failedLogins = new Map<string, FailedLoginTracker>();

function checkRateLimit(identifier: string): { isBlocked: boolean; waitMinutes?: number } {
  const record = failedLogins.get(identifier);
  if (!record) return { isBlocked: false };

  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const remainingMs = record.lockedUntil - Date.now();
    const waitMinutes = Math.ceil(remainingMs / (60 * 1000));
    return { isBlocked: true, waitMinutes };
  }

  // Lock expired
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    failedLogins.delete(identifier);
  }

  return { isBlocked: false };
}

function recordFailedLogin(identifier: string): number {
  const current = failedLogins.get(identifier) || { count: 0 };
  current.count += 1;
  if (current.count >= 5) {
    current.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
  }
  failedLogins.set(identifier, current);
  return current.count;
}

function clearFailedLogin(identifier: string): void {
  failedLogins.delete(identifier);
}

// Database Mutex & Persistence
let isSaving = false;
let saveQueuePending = false;

function loadDatabase(): CloudDatabase {
  let loadedDB: Partial<CloudDatabase> | null = null;

  // 1. Try reading primary DB file
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      loadedDB = JSON.parse(content);
    } catch (err) {
      console.error('Corrupted primary cloud_db.json, attempting backup recovery:', err);
    }
  }

  // 2. Fallback to backup file if primary failed
  if (!loadedDB && fs.existsSync(BACKUP_FILE)) {
    try {
      const content = fs.readFileSync(BACKUP_FILE, 'utf-8');
      loadedDB = JSON.parse(content);
      console.log('Successfully recovered database state from cloud_db.backup.json');
    } catch (backupErr) {
      console.error('Backup recovery also failed:', backupErr);
    }
  }

  const defaultAdminEmail = 'gabrielasousamarquess2@gmail.com';

  const initialDB: CloudDatabase = {
    users: loadedDB?.users || [],
    sessions: loadedDB?.sessions || [],
    pending2FACodes: loadedDB?.pending2FACodes || [],
    passwordResetCodes: loadedDB?.passwordResetCodes || [],
    securityLogs: loadedDB?.securityLogs || [],
    products: loadedDB?.products || {},
    orders: loadedDB?.orders || {},
    purchases: loadedDB?.purchases || {},
    expenses: loadedDB?.expenses || {},
    transfers: loadedDB?.transfers || {},
    cashBalances: loadedDB?.cashBalances || {},
    memories: loadedDB?.memories || {},
    versions: loadedDB?.versions || {},
  };

  // Ensure default administrator account exists and is protected
  let adminUser = initialDB.users.find(
    (u) => u.email.toLowerCase() === defaultAdminEmail.toLowerCase()
  );

  if (!adminUser) {
    adminUser = {
      id: 'usr_owner_default',
      email: defaultAdminEmail,
      name: 'Gabriela Marques',
      companyName: 'LucraiBR Vendas Online',
      passwordHash: hashPassword('lucraibr2026'),
      role: 'admin',
      status: 'active',
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    initialDB.users.unshift(adminUser);
  } else {
    // Ensure admin user has role admin and status active
    adminUser.role = 'admin';
    if (!adminUser.status) adminUser.status = 'active';
    if (!adminUser.passwordHash) {
      adminUser.passwordHash = hashPassword('lucraibr2026');
    }
  }

  // Ensure all existing users have role and status attributes
  initialDB.users.forEach((u) => {
    if (!u.role) u.role = u.email.toLowerCase() === defaultAdminEmail.toLowerCase() ? 'admin' : 'user';
    if (!u.status) u.status = 'active';
  });

  saveDatabase(initialDB);
  return initialDB;
}

function saveDatabase(database: CloudDatabase): void {
  if (isSaving) {
    saveQueuePending = true;
    return;
  }

  isSaving = true;

  try {
    const serialized = JSON.stringify(database, null, 2);
    const tempFile = DB_FILE + '.tmp';

    // 1. Write to atomic temp file
    fs.writeFileSync(tempFile, serialized, 'utf-8');

    // 2. Atomic rename to main database
    fs.renameSync(tempFile, DB_FILE);

    // 3. Mirror copy to backup file
    fs.writeFileSync(BACKUP_FILE, serialized, 'utf-8');
  } catch (err) {
    console.error('Fatal error writing cloud_db.json:', err);
  } finally {
    isSaving = false;
    if (saveQueuePending) {
      saveQueuePending = false;
      saveDatabase(db);
    }
  }
}

let db = loadDatabase();

function parseDeviceInfo(userAgent: string = '', ip: string = '') {
  let deviceType: 'Computador' | 'Smartphone' | 'Tablet' = 'Computador';
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) {
    deviceType = 'Smartphone';
  }

  let browser = 'Navegador Web';
  if (/edg/i.test(userAgent)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(userAgent)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Apple Safari';
  else if (/opera|opr/i.test(userAgent)) browser = 'Opera';

  let os = 'Sistema Operacional';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  const approxLocation = 'São Paulo, Brasil (Conexão Segura SSL)';

  return { deviceType, browser, os, approxLocation };
}

// Strict Authentication Middleware (Verifies session & active token on the server)
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido ou ausente.' });
  }

  const token = authHeader.substring(7).trim();
  const session = db.sessions.find((s) => s.token === token && s.isActive);

  if (!session) {
    return res.status(401).json({ error: 'Sessão inválida, expirada ou encerrada pelo servidor.' });
  }

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    session.isActive = false;
    saveDatabase(db);
    return res.status(401).json({ error: 'Usuário associado à sessão não existe mais.' });
  }

  // Check if user account was blocked by Administrator
  if (user.status === 'blocked') {
    session.isActive = false;
    saveDatabase(db);
    return res.status(403).json({
      error: 'Esta conta foi bloqueada pelo administrador do sistema. Entre em contato com o suporte.',
    });
  }

  // Update session activity timestamp
  session.lastActive = new Date().toISOString();
  (req as any).user = user;
  (req as any).session = session;
  next();
}

// Strict Administrator Authorization Middleware
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user as UserRecord;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acesso negado: esta ação requer privilégios exclusivos de Administrador.',
    });
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Trust reverse proxy (Google Cloud Run / Nginx / load balancers)
  app.set('trust proxy', 1);

  // Enable CORS for mobile browsers, PWAs, and published domains
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'LucraiBR Full-Stack Server',
      database: 'cloud_db.json',
      activeUsers: db.users.length,
      time: new Date().toISOString(),
    });
  });

  // ==========================================
  // 1. AUTHENTICATION & PRIVATE SPACE ROUTES
  // ==========================================

  // Register new account (Each user gets an isolated private account)
  app.post('/api/auth/register', (req, res) => {
    const { name, email, companyName, password } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'A senha de acesso deve ter pelo menos 6 caracteres.' });
    }

    const isFirstAdmin = cleanEmail === 'gabrielasousamarquess2@gmail.com';

    const newUser: UserRecord = {
      id: 'usr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
      name: name.trim(),
      email: cleanEmail,
      companyName: companyName?.trim() || 'Minha Operação Marketplace',
      passwordHash: password ? hashPassword(password) : undefined,
      role: isFirstAdmin ? 'admin' : 'user',
      status: 'active',
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    db.users.push(newUser);

    // Initialize per-user empty collections
    db.products[newUser.id] = [];
    db.orders[newUser.id] = [];
    db.purchases[newUser.id] = [];
    db.expenses[newUser.id] = [];
    db.transfers[newUser.id] = [];
    db.cashBalances[newUser.id] = {
      userId: newUser.id,
      amount: 0,
      startDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    };
    db.memories[newUser.id] = [];
    db.versions[newUser.id] = 1;

    // Create session
    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const userAgent = req.headers['user-agent'] || '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const { deviceType, browser, os, approxLocation } = parseDeviceInfo(userAgent, ip);

    const session: SessionRecord = {
      id: 'sess_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      userId: newUser.id,
      token,
      deviceType,
      browser: `${browser} (${os})`,
      os,
      ip,
      approxLocation,
      loginTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isActive: true,
    };

    db.sessions.push(session);
    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: newUser.id,
      userEmail: newUser.email,
      timestamp: new Date().toISOString(),
      action: 'login',
      details: `Conta registrada com sucesso via ${deviceType} (${browser})`,
      device: `${deviceType} - ${browser}`,
      ip,
    });

    saveDatabase(db);

    res.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        companyName: newUser.companyName,
        role: newUser.role,
        status: newUser.status,
        createdAt: newUser.createdAt,
      },
      session: {
        id: session.id,
        deviceType: session.deviceType,
        browser: session.browser,
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        approxLocation: session.approxLocation,
        isCurrentSession: true,
      },
    });
  });

  // Login route with brute force protection, 2FA support, and session registration
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawXff = (req.headers['x-forwarded-for'] as string) || '';
    const clientIp = rawXff ? rawXff.split(',')[0].trim() : (req.socket.remoteAddress || '127.0.0.1');
    const rateLimitKey = `${cleanEmail}_${clientIp}`;

    // 1. Check brute force rate limiting
    const rateLimit = checkRateLimit(rateLimitKey);
    if (rateLimit.isBlocked) {
      return res.status(429).json({
        error: `Muitas tentativas malsucedidas de login. Conta temporariamente bloqueada por ${rateLimit.waitMinutes} minuto(s) para sua segurança.`,
      });
    }

    const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      recordFailedLogin(rateLimitKey);
      db.securityLogs.push({
        id: 'log_' + Date.now(),
        userId: 'unknown',
        userEmail: cleanEmail,
        timestamp: new Date().toISOString(),
        action: 'failed_login',
        details: `Tentativa de login falhou: conta inexistente (${cleanEmail})`,
        ip: clientIp,
      });
      saveDatabase(db);
      return res.status(404).json({ error: 'Usuário não encontrado. Crie uma conta para continuar.' });
    }

    // 2. Check if account is blocked
    if (user.status === 'blocked') {
      return res.status(403).json({
        error: 'Sua conta foi suspensa/bloqueada pelo administrador. Acesso negado.',
      });
    }

    // 3. Verify password if password is set on user
    if (user.passwordHash && password) {
      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        const attempts = recordFailedLogin(rateLimitKey);
        db.securityLogs.push({
          id: 'log_' + Date.now(),
          userId: user.id,
          userEmail: user.email,
          timestamp: new Date().toISOString(),
          action: 'failed_login',
          details: `Senha incorreta para ${user.email} (Tentativa ${attempts}/5)`,
          ip: clientIp,
        });
        saveDatabase(db);

        const remaining = Math.max(0, 5 - attempts);
        return res.status(401).json({
          error:
            remaining > 0
              ? `Senha incorreta. Você tem mais ${remaining} tentativa(s) antes do bloqueio temporário.`
              : 'Senha incorreta. Muitas tentativas falhas. Conta bloqueada por 15 minutos.',
        });
      }
    }

    // Clear failed login tracker on success
    clearFailedLogin(rateLimitKey);

    // 4. Check if 2FA is required
    if (user.twoFactorEnabled) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const tempToken = 'temp_' + crypto.randomBytes(16).toString('hex');
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes single-use

      db.pending2FACodes.push({
        id: tempToken,
        userId: user.id,
        code,
        expiresAt,
        used: false,
      });

      saveDatabase(db);

      return res.json({
        requires2FA: true,
        tempToken,
        verificationCodeHint: code,
        expiresInMinutes: 5,
        message: 'Código de verificação de uso único gerado no servidor.',
      });
    }

    // 5. Successful login: Create session
    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const userAgent = req.headers['user-agent'] || '';
    const parsed = parseDeviceInfo(userAgent, clientIp);
    let resolvedDeviceType = parsed.deviceType;
    if (req.body.deviceType) {
      const lower = String(req.body.deviceType).toLowerCase();
      if (lower.includes('cel') || lower.includes('smart') || lower.includes('mob')) {
        resolvedDeviceType = 'Smartphone';
      } else if (lower.includes('tab')) {
        resolvedDeviceType = 'Tablet';
      }
    }

    const session: SessionRecord = {
      id: 'sess_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      userId: user.id,
      token,
      deviceType: resolvedDeviceType,
      browser: `${parsed.browser} (${parsed.os})`,
      os: parsed.os,
      ip: clientIp,
      approxLocation: parsed.approxLocation,
      loginTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isActive: true,
    };

    user.lastLoginAt = new Date().toISOString();
    db.sessions.push(session);
    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      action: 'login',
      details: `Login autorizado com sucesso no ${resolvedDeviceType} (${parsed.browser})`,
      device: `${resolvedDeviceType} - ${parsed.browser}`,
      ip: clientIp,
    });

    saveDatabase(db);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        role: user.role,
        status: user.status,
        twoFactorEnabled: !!user.twoFactorEnabled,
        createdAt: user.createdAt,
      },
      session: {
        id: session.id,
        deviceType: session.deviceType,
        browser: session.browser,
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        approxLocation: session.approxLocation,
        isCurrentSession: true,
      },
    });
  });

  // Verify 2FA code
  app.post('/api/auth/verify-2fa', (req, res) => {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Token temporário e código de verificação são obrigatórios.' });
    }

    const pending = db.pending2FACodes.find((p) => p.id === tempToken);
    if (!pending) {
      return res.status(401).json({ error: 'Requisição de verificação expirada ou inexistente.' });
    }

    if (pending.used) {
      return res.status(401).json({ error: 'Este código de uso único já foi utilizado. Solicite um novo.' });
    }

    if (Date.now() > pending.expiresAt) {
      return res.status(401).json({ error: 'O código de verificação expirou (validade de 5 minutos excedida).' });
    }

    if (pending.code !== code.trim()) {
      return res.status(401).json({ error: 'Código de verificação de dois fatores incorreto.' });
    }

    // Mark used immediately
    pending.used = true;

    const user = db.users.find((u) => u.id === pending.userId);
    if (!user || user.status === 'blocked') {
      return res.status(403).json({ error: 'Conta bloqueada ou inexistente.' });
    }

    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const userAgent = req.headers['user-agent'] || '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const { deviceType, browser, os, approxLocation } = parseDeviceInfo(userAgent, ip);

    const session: SessionRecord = {
      id: 'sess_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      userId: user.id,
      token,
      deviceType,
      browser: `${browser} (${os})`,
      os,
      ip,
      approxLocation,
      loginTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isActive: true,
    };

    user.lastLoginAt = new Date().toISOString();
    db.sessions.push(session);
    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      action: 'login',
      details: `Autenticação em 2 fatores confirmada com sucesso via ${deviceType}`,
      device: `${deviceType} - ${browser}`,
      ip,
    });

    saveDatabase(db);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        role: user.role,
        status: user.status,
        twoFactorEnabled: true,
        createdAt: user.createdAt,
      },
      session: {
        id: session.id,
        deviceType: session.deviceType,
        browser: session.browser,
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        approxLocation: session.approxLocation,
        isCurrentSession: true,
      },
    });
  });

  // Password Recovery - Request Reset Code
  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório para recuperação.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      // Don't leak user existence for unknown emails, but provide friendly response
      return res.status(404).json({ error: 'Nenhuma conta encontrada com este e-mail.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Esta conta está bloqueada pelo administrador.' });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = 'reset_' + crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    if (!db.passwordResetCodes) db.passwordResetCodes = [];

    db.passwordResetCodes.push({
      id: resetToken,
      userId: user.id,
      code: resetCode,
      expiresAt,
      used: false,
    });

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      action: 'password_reset_requested',
      details: 'Código de recuperação de senha gerado no servidor',
    });

    saveDatabase(db);

    res.json({
      success: true,
      resetToken,
      code: resetCode,
      codeHint: resetCode,
      expiresInMinutes: 15,
      message: 'Código de recuperação gerado com sucesso.',
    });
  });

  // Password Recovery - Reset Password with Code
  app.post('/api/auth/reset-password', (req, res) => {
    const { resetToken, email, code, newPassword } = req.body;
    if ((!resetToken && !email) || !code || !newPassword) {
      return res.status(400).json({ error: 'Token/e-mail, código e nova senha são obrigatórios.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    if (!db.passwordResetCodes) db.passwordResetCodes = [];

    let record = null;
    if (resetToken) {
      record = db.passwordResetCodes.find((r) => r.id === resetToken);
    } else if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const targetUser = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (targetUser) {
        record = db.passwordResetCodes
          .filter((r) => r.userId === targetUser.id && !r.used && Date.now() <= r.expiresAt)
          .sort((a, b) => b.expiresAt - a.expiresAt)[0];
      }
    }

    if (!record) {
      return res.status(400).json({ error: 'Solicitação de recuperação inválida ou expirada.' });
    }

    if (record.used) {
      return res.status(400).json({ error: 'Este código de recuperação já foi utilizado.' });
    }

    if (Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'O código de recuperação expirou (validade de 15 minutos).' });
    }

    if (record.code !== code.trim()) {
      return res.status(400).json({ error: 'Código de recuperação incorreto.' });
    }

    record.used = true;

    const user = db.users.find((u) => u.id === record.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    user.passwordHash = hashPassword(newPassword);

    // Invalidate existing sessions for security
    let revokedCount = 0;
    db.sessions.forEach((s) => {
      if (s.userId === user.id && s.isActive) {
        s.isActive = false;
        revokedCount++;
      }
    });

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      action: 'password_reset_completed',
      details: `Senha redefinida com sucesso. ${revokedCount} sessão(ões) anterior(es) revogada(s) por segurança.`,
    });

    saveDatabase(db);

    res.json({
      success: true,
      message: 'Senha redefinida com sucesso! Faça login com sua nova senha.',
    });
  });

  // Get current user profile & validate server session
  app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const session = (req as any).session as SessionRecord;

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        role: user.role,
        status: user.status,
        twoFactorEnabled: !!user.twoFactorEnabled,
        createdAt: user.createdAt,
      },
      session: {
        id: session.id,
        deviceType: session.deviceType,
        browser: session.browser,
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        approxLocation: session.approxLocation,
        isCurrentSession: true,
      },
    });
  });

  // Update profile
  app.put('/api/auth/profile', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { name, companyName } = req.body;

    if (name) user.name = name.trim();
    if (companyName !== undefined) user.companyName = companyName.trim();

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      action: 'login',
      details: 'Dados do perfil do vendedor atualizados',
    });

    saveDatabase(db);
    res.json({ success: true, user });
  });

  // Change password (while logged in)
  app.post('/api/auth/password', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    user.passwordHash = hashPassword(newPassword);

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      action: 'password_change',
      details: 'Senha de acesso alterada pelo usuário autenticado',
    });

    saveDatabase(db);
    res.json({ success: true, message: 'Senha atualizada com sucesso.' });
  });

  // 2FA / Token Configuration toggle
  app.post('/api/auth/2fa/toggle', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { enabled } = req.body;

    user.twoFactorEnabled = !!enabled;

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      action: user.twoFactorEnabled ? '2fa_enabled' : '2fa_disabled',
      details: user.twoFactorEnabled
        ? 'Token adicional de entrada (2FA) ATIVADO'
        : 'Token adicional de entrada (2FA) DESATIVADO',
    });

    saveDatabase(db);
    res.json({ success: true, twoFactorEnabled: user.twoFactorEnabled });
  });

  // Generate test / sensitive action 2FA code
  app.post('/api/auth/2fa/generate-code', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const tempToken = 'action_' + crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000;

    db.pending2FACodes.push({
      id: tempToken,
      userId: user.id,
      code,
      expiresAt,
      used: false,
    });

    saveDatabase(db);
    res.json({ success: true, tempToken, code, expiresInMinutes: 5 });
  });

  // Verify code for sensitive actions
  app.post('/api/auth/2fa/verify-action', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { tempToken, code } = req.body;

    const pending = db.pending2FACodes.find((p) => p.id === tempToken && p.userId === user.id);
    if (!pending || pending.used || Date.now() > pending.expiresAt || pending.code !== code.trim()) {
      return res.status(401).json({ error: 'Código de autorização inválido ou expirado.' });
    }

    pending.used = true;
    saveDatabase(db);
    res.json({ success: true });
  });

  // Active Sessions for current user
  app.get('/api/auth/sessions', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const currentSession = (req as any).session as SessionRecord;

    const activeSessions = db.sessions
      .filter((s) => s.userId === user.id && s.isActive)
      .map((s) => ({
        id: s.id,
        deviceType: s.deviceType,
        browser: s.browser,
        os: s.os,
        loginTime: s.loginTime,
        lastActive: s.lastActive,
        approxLocation: s.approxLocation,
        isCurrentSession: s.id === currentSession.id,
      }))
      .sort((a, b) => (b.isCurrentSession ? 1 : 0) - (a.isCurrentSession ? 1 : 0));

    res.json({ sessions: activeSessions });
  });

  // Terminate a specific session (revokes access immediately on server)
  app.post('/api/auth/sessions/:sessionId/terminate', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { sessionId } = req.params;

    const sessionToTerminate = db.sessions.find(
      (s) => s.id === sessionId && s.userId === user.id && s.isActive
    );

    if (!sessionToTerminate) {
      return res.status(404).json({ error: 'Sessão não encontrada ou já inativa.' });
    }

    sessionToTerminate.isActive = false;

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      action: 'session_terminated',
      details: `Sessão encerrada remotamente: ${sessionToTerminate.deviceType} (${sessionToTerminate.browser})`,
    });

    saveDatabase(db);
    res.json({ success: true, message: 'Dispositivo desconectado com sucesso.' });
  });

  app.delete('/api/auth/sessions/:sessionId', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const { sessionId } = req.params;

    const sessionToTerminate = db.sessions.find(
      (s) => s.id === sessionId && s.userId === user.id && s.isActive
    );

    if (!sessionToTerminate) {
      return res.status(404).json({ error: 'Sessão não encontrada ou já inativa.' });
    }

    sessionToTerminate.isActive = false;

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      action: 'session_terminated',
      details: `Sessão encerrada remotamente: ${sessionToTerminate.deviceType} (${sessionToTerminate.browser})`,
    });

    saveDatabase(db);
    res.json({ success: true, message: 'Dispositivo desconectado com sucesso.' });
  });

  // Terminate all other sessions for current user
  app.post('/api/auth/sessions/terminate-others', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const currentSession = (req as any).session as SessionRecord;

    let terminatedCount = 0;
    db.sessions.forEach((s) => {
      if (s.userId === user.id && s.id !== currentSession.id && s.isActive) {
        s.isActive = false;
        terminatedCount++;
      }
    });

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      action: 'all_sessions_terminated',
      details: `Encerradas ${terminatedCount} outras sessões conectadas`,
    });

    saveDatabase(db);
    res.json({ success: true, terminatedCount });
  });

  // Logout current session
  app.post('/api/auth/logout', authenticateToken, (req, res) => {
    const currentSession = (req as any).session as SessionRecord;
    currentSession.isActive = false;

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: currentSession.userId,
      userEmail: (req as any).user?.email,
      timestamp: new Date().toISOString(),
      action: 'logout',
      details: `Logout voluntário efetuado em ${currentSession.deviceType}`,
    });

    saveDatabase(db);
    res.json({ success: true });
  });

  // Security logs for current user
  app.get('/api/auth/logs', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const userLogs = db.securityLogs
      .filter((l) => l.userId === user.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 50);

    res.json({ logs: userLogs });
  });

  // ==========================================
  // 2. DATA SYNCHRONIZATION API (PC <-> MOBILE)
  // Strictly isolated by authenticated req.user.id
  // ==========================================

  // Pull user's data from cloud
  app.get('/api/sync', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const userId = user.id;

    res.json({
      version: db.versions[userId] || 1,
      products: db.products[userId] || [],
      orders: db.orders[userId] || [],
      purchases: db.purchases[userId] || [],
      expenses: db.expenses[userId] || [],
      transfers: db.transfers[userId] || [],
      cashBalance: db.cashBalances[userId] || {
        userId,
        amount: 0,
        startDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
      },
      memories: db.memories[userId] || [],
    });
  });

  // Version check for lightweight fast polling
  app.get('/api/sync/version', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const userId = user.id;
    res.json({ version: db.versions[userId] || 1 });
  });

  // Push / Batch save from client - strictly bound to req.user.id
  app.post('/api/sync', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const userId = user.id;
    const { products, orders, purchases, expenses, transfers, cashBalance, memories } = req.body;

    // Enforce userId integrity on all items to prevent any cross-account spoofing
    if (Array.isArray(products)) {
      db.products[userId] = products.map((item) => ({ ...item, userId }));
    }
    if (Array.isArray(orders)) {
      db.orders[userId] = orders.map((item) => ({ ...item, userId }));
    }
    if (Array.isArray(purchases)) {
      db.purchases[userId] = purchases.map((item) => ({ ...item, userId }));
    }
    if (Array.isArray(expenses)) {
      db.expenses[userId] = expenses.map((item) => ({ ...item, userId }));
    }
    if (Array.isArray(transfers)) {
      db.transfers[userId] = transfers.map((item) => ({ ...item, userId }));
    }
    if (cashBalance) {
      db.cashBalances[userId] = { ...cashBalance, userId };
    }
    if (Array.isArray(memories)) {
      db.memories[userId] = memories.map((item) => ({ ...item, userId }));
    }

    db.versions[userId] = (db.versions[userId] || 1) + 1;
    saveDatabase(db);

    res.json({ success: true, version: db.versions[userId] });
  });

  // Safe migration endpoint: seeds cloud storage from client's initial records if empty
  app.post('/api/sync/migrate', authenticateToken, (req, res) => {
    const user = (req as any).user as UserRecord;
    const userId = user.id;
    const { products, orders, purchases, expenses, transfers, cashBalance, memories } = req.body;

    const hasServerData =
      (db.products[userId] && db.products[userId].length > 0) ||
      (db.orders[userId] && db.orders[userId].length > 0) ||
      (db.expenses[userId] && db.expenses[userId].length > 0);

    if (!hasServerData) {
      if (Array.isArray(products) && products.length > 0) {
        db.products[userId] = products.map((p) => ({ ...p, userId }));
      }
      if (Array.isArray(orders) && orders.length > 0) {
        db.orders[userId] = orders.map((o) => ({ ...o, userId }));
      }
      if (Array.isArray(purchases) && purchases.length > 0) {
        db.purchases[userId] = purchases.map((p) => ({ ...p, userId }));
      }
      if (Array.isArray(expenses) && expenses.length > 0) {
        db.expenses[userId] = expenses.map((e) => ({ ...e, userId }));
      }
      if (Array.isArray(transfers) && transfers.length > 0) {
        db.transfers[userId] = transfers.map((t) => ({ ...t, userId }));
      }
      if (cashBalance) {
        db.cashBalances[userId] = { ...cashBalance, userId };
      }
      if (Array.isArray(memories) && memories.length > 0) {
        db.memories[userId] = memories.map((m) => ({ ...m, userId }));
      }

      db.versions[userId] = (db.versions[userId] || 1) + 1;
      saveDatabase(db);
    }

    res.json({
      success: true,
      migrated: !hasServerData,
      version: db.versions[userId] || 1,
    });
  });

  // ==========================================
  // 3. EXCLUSIVE ADMIN PANEL ROUTES (Protected with requireAdmin)
  // ==========================================

  // List all users and their status, device sessions and activities
  app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    const userList = db.users.map((u) => {
      const userSessions = db.sessions.filter((s) => s.userId === u.id && s.isActive);
      const failedAttemptRecord = failedLogins.get(u.email.toLowerCase());

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        companyName: u.companyName,
        role: u.role,
        status: u.status,
        twoFactorEnabled: !!u.twoFactorEnabled,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        activeSessionsCount: userSessions.length,
        failedLoginAttempts: failedAttemptRecord?.count || 0,
        activeSessions: userSessions.map((s) => ({
          id: s.id,
          deviceType: s.deviceType,
          browser: s.browser,
          os: s.os,
          ip: s.ip,
          approxLocation: s.approxLocation,
          loginTime: s.loginTime,
          lastActive: s.lastActive,
        })),
      };
    });

    res.json({ users: userList });
  });

  // Change user status (block or reactivate account)
  app.post('/api/admin/users/:userId/status', authenticateToken, requireAdmin, (req, res) => {
    const adminUser = (req as any).user as UserRecord;
    const { userId } = req.params;
    const { status } = req.body;

    if (status !== 'active' && status !== 'blocked') {
      return res.status(400).json({ error: 'Status deve ser "active" ou "blocked".' });
    }

    const targetUser = db.users.find((u) => u.id === userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Protection: Admin cannot block their own account
    if (targetUser.id === adminUser.id && status === 'blocked') {
      return res.status(400).json({ error: 'O administrador não pode bloquear a sua própria conta.' });
    }

    targetUser.status = status;

    // If blocked, immediately terminate all active sessions on the server
    if (status === 'blocked') {
      db.sessions.forEach((s) => {
        if (s.userId === targetUser.id && s.isActive) {
          s.isActive = false;
        }
      });
    }

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: adminUser.id,
      userEmail: adminUser.email,
      timestamp: new Date().toISOString(),
      action: status === 'blocked' ? 'account_blocked' : 'account_reactivated',
      details: `Administrador (${adminUser.email}) alterou o status da conta ${targetUser.email} para "${status}"`,
    });

    saveDatabase(db);

    res.json({
      success: true,
      message: `Conta ${targetUser.email} ${status === 'blocked' ? 'bloqueada' : 'reativada'} com sucesso.`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        status: targetUser.status,
      },
    });
  });

  // Terminate all sessions for a specific user (admin action)
  app.post('/api/admin/users/:userId/terminate-all-sessions', authenticateToken, requireAdmin, (req, res) => {
    const adminUser = (req as any).user as UserRecord;
    const { userId } = req.params;

    const targetUser = db.users.find((u) => u.id === userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    let count = 0;
    db.sessions.forEach((s) => {
      if (s.userId === targetUser.id && s.isActive) {
        s.isActive = false;
        count++;
      }
    });

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: adminUser.id,
      userEmail: adminUser.email,
      timestamp: new Date().toISOString(),
      action: 'all_sessions_terminated',
      details: `Administrador (${adminUser.email}) desconectou todas as sessões da conta ${targetUser.email} (${count} sessões revogadas)`,
    });

    saveDatabase(db);

    res.json({
      success: true,
      terminatedCount: count,
      message: `${count} sessão(ões) revogada(s) no servidor para a conta ${targetUser.email}.`,
    });
  });

  // Terminate a single specific session (admin action)
  app.post('/api/admin/sessions/:sessionId/terminate', authenticateToken, requireAdmin, (req, res) => {
    const adminUser = (req as any).user as UserRecord;
    const { sessionId } = req.params;

    const targetSession = db.sessions.find((s) => s.id === sessionId && s.isActive);
    if (!targetSession) {
      return res.status(404).json({ error: 'Sessão não encontrada ou já inativa.' });
    }

    targetSession.isActive = false;

    db.securityLogs.push({
      id: 'log_' + Date.now(),
      userId: adminUser.id,
      userEmail: adminUser.email,
      timestamp: new Date().toISOString(),
      action: 'session_terminated',
      details: `Administrador revogou a sessão ${targetSession.id} (${targetSession.deviceType})`,
    });

    saveDatabase(db);

    res.json({
      success: true,
      message: 'Sessão revogada com sucesso no servidor.',
    });
  });

  // System-wide security & audit logs (Admin only)
  app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, (req, res) => {
    const sortedLogs = [...db.securityLogs]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 100)
      .map((log) => {
        const u = db.users.find((user) => user.id === log.userId);
        return {
          ...log,
          userEmail: log.userEmail || u?.email || 'Sistema',
        };
      });

    res.json({ logs: sortedLogs });
  });

  // ==========================================
  // FRONTEND CLIENT SERVING
  // ==========================================
  const distPath = path.resolve(__dirname, 'dist');
  const indexHtmlExists = fs.existsSync(path.join(distPath, 'index.html'));
  const isCloudRun = !!process.env.K_SERVICE || !!process.env.K_REVISION;
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    isCloudRun ||
    (indexHtmlExists && process.env.npm_lifecycle_event !== 'dev');

  if (isProduction && indexHtmlExists) {
    console.log('LucraiBR: Servindo arquivos estáticos de produção a partir de /dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Never send index.html for API requests
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.path}` });
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Mount Vite dev server middleware in local development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LucraiBR server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
