import { PasskeyUser, PasskeyCredential, ChallengeStore, UserStore } from '../types';

/**
 * Implementación simple de ChallengeStore en memoria
 * NOTA: No usar en producción - los challenges se pierden al reiniciar
 */
export class MemoryChallengeStore implements ChallengeStore {
  private challenges: Map<string, string> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  set(key: string, value: string, ttl: number = 300000): void { // 5 minutos por defecto
    this.challenges.set(key, value);
    
    // Limpiar timeout anterior si existe
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Configurar auto-limpieza
    const timeout = setTimeout(() => {
      this.challenges.delete(key);
      this.timeouts.delete(key);
    }, ttl);

    this.timeouts.set(key, timeout);
  }

  get(key: string): string | undefined {
    return this.challenges.get(key);
  }

  delete(key: string): void {
    this.challenges.delete(key);
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
  }

  clear(): void {
    this.challenges.clear();
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
  }
}

/**
 * Implementación simple de UserStore en memoria
 * NOTA: No usar en producción - los datos se pierden al reiniciar
 */
export class MemoryUserStore implements UserStore {
  private users: Map<string, PasskeyUser> = new Map();
  private usernameIndex: Map<string, string> = new Map(); // username -> userId

  async createUser(userData: Omit<PasskeyUser, 'credentials'>): Promise<PasskeyUser> {
    const user: PasskeyUser = {
      ...userData,
      credentials: [],
    };

    this.users.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
    
    return user;
  }

  async getUserById(id: string): Promise<PasskeyUser | null> {
    return this.users.get(id) || null;
  }

  async getUserByUsername(username: string): Promise<PasskeyUser | null> {
    const userId = this.usernameIndex.get(username);
    if (!userId) return null;
    
    return this.users.get(userId) || null;
  }

  async updateUser(user: PasskeyUser): Promise<PasskeyUser> {
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
    return user;
  }

  async addCredential(userId: string, credential: PasskeyCredential): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`Usuario con ID ${userId} no encontrado`);
    }

    // Verificar si ya existe una credencial con el mismo ID
    const existingIndex = user.credentials.findIndex(cred => cred.id === credential.id);
    if (existingIndex >= 0) {
      user.credentials[existingIndex] = credential;
    } else {
      user.credentials.push(credential);
    }

    this.users.set(userId, user);
  }

  async removeCredential(userId: string, credentialId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`Usuario con ID ${userId} no encontrado`);
    }

    user.credentials = user.credentials.filter(cred => cred.id !== credentialId);
    this.users.set(userId, user);
  }

  async getAllUsers(): Promise<PasskeyUser[]> {
    return Array.from(this.users.values());
  }

  clear(): void {
    this.users.clear();
    this.usernameIndex.clear();
  }
}