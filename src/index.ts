// Exportar la clase principal
export { PasskeyAuth } from './PasskeyAuth';

// Exportar tipos
export type {
  PasskeyUser,
  PasskeyCredential,
  PasskeyConfig,
  RegistrationResult,
  AuthenticationResult,
  ChallengeStore,
  UserStore,
} from './types';

// Exportar implementaciones por defecto
export {
  MemoryChallengeStore,
  MemoryUserStore
} from './stores/MemoryStore';

// Exportar database stores (opcional - requieren instalar dependencias)
export { MongoDBUserStore } from './stores/database/MongoDBStore';
export { PostgreSQLUserStore } from './stores/database/PostgreSQLStore';
export { MySQLUserStore } from './stores/database/MySQLStore';

// Exportar utilidades para Express.js
export { createExpressMiddleware, createExpressRoutes } from './middleware/express';

// Función de conveniencia para inicializar rápidamente
export function createPasskeyAuth(config: {
  rpName: string;
  rpID: string;
  origin: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
}) {
  const { MemoryChallengeStore, MemoryUserStore } = require('./stores/MemoryStore');
  const { PasskeyAuth } = require('./PasskeyAuth');
  
  const challengeStore = new MemoryChallengeStore();
  const userStore = new MemoryUserStore();
  
  return new PasskeyAuth(config, userStore, challengeStore);
}