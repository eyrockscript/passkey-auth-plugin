export interface PasskeyUser {
  id: string;
  username: string;
  displayName: string;
  credentials: PasskeyCredential[];
}

export interface PasskeyCredential {
  id: string;
  publicKey: Uint8Array;
  counter: number;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports?: AuthenticatorTransport[];
}

export interface PasskeyConfig {
  rpName: string;
  rpID: string;
  origin: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
}

export interface RegistrationResult {
  verified: boolean;
  credential?: PasskeyCredential;
  error?: string;
}

export interface AuthenticationResult {
  verified: boolean;
  user?: PasskeyUser;
  credential?: PasskeyCredential;
  error?: string;
}

export interface ChallengeStore {
  set(key: string, value: string): void;
  get(key: string): string | undefined;
  delete(key: string): void;
}

export interface UserStore {
  createUser(user: Omit<PasskeyUser, 'credentials'>): Promise<PasskeyUser>;
  getUserById(id: string): Promise<PasskeyUser | null>;
  getUserByUsername(username: string): Promise<PasskeyUser | null>;
  updateUser(user: PasskeyUser): Promise<PasskeyUser>;
  addCredential(userId: string, credential: PasskeyCredential): Promise<void>;
}