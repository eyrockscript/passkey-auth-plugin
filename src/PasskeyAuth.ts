import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import {
  PasskeyConfig,
  PasskeyUser,
  PasskeyCredential,
  RegistrationResult,
  AuthenticationResult,
  ChallengeStore,
  UserStore,
} from './types';

export class PasskeyAuth {
  private config: PasskeyConfig;
  private challengeStore: ChallengeStore;
  private userStore: UserStore;

  constructor(config: PasskeyConfig, userStore: UserStore, challengeStore: ChallengeStore) {
    this.config = config;
    this.userStore = userStore;
    this.challengeStore = challengeStore;
  }

  /**
   * Genera opciones para el registro de un nuevo passkey
   */
  async generateRegistrationOptions(userId: string, username: string, displayName: string) {
    const user = await this.userStore.getUserById(userId) || 
                 await this.userStore.createUser({ id: userId, username, displayName });

    const excludeCredentials = user.credentials.map(cred => ({
      id: cred.id,
      type: 'public-key' as const,
      transports: cred.transports,
    }));

    const opts: GenerateRegistrationOptionsOpts = {
      rpName: this.config.rpName,
      rpID: this.config.rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.username,
      userDisplayName: user.displayName,
      timeout: this.config.timeout || 60000,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: this.config.userVerification || 'preferred',
        authenticatorAttachment: 'platform',
      },
      supportedAlgorithmIDs: [-7, -257],
    };

    const options = await generateRegistrationOptions(opts);
    
    // Guardar el challenge para verificación posterior
    this.challengeStore.set(`reg_${userId}`, options.challenge);

    return options;
  }

  /**
   * Verifica la respuesta de registro de un passkey
   */
  async verifyRegistration(userId: string, response: any): Promise<RegistrationResult> {
    try {
      const expectedChallenge = this.challengeStore.get(`reg_${userId}`);
      if (!expectedChallenge) {
        return { verified: false, error: 'Challenge no encontrado o expirado' };
      }

      const opts: VerifyRegistrationResponseOpts = {
        response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpID,
        requireUserVerification: this.config.userVerification === 'required',
      };

      const verification = await verifyRegistrationResponse(opts);

      if (verification.verified && verification.registrationInfo) {
        const { credential: cred, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        const credential: PasskeyCredential = {
          id: cred.id,
          publicKey: cred.publicKey,
          counter: cred.counter,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: response.response.transports,
          createdAt: new Date(),
          lastUsedAt: new Date(),
        };

        await this.userStore.addCredential(userId, credential);
        this.challengeStore.delete(`reg_${userId}`);

        return { verified: true, credential };
      }

      return { verified: false, error: 'Verificación de registro falló' };
    } catch (error) {
      return { verified: false, error: `Error en verificación: ${(error as Error).message}` };
    }
  }

  /**
   * Genera opciones para la autenticación con passkey
   */
  async generateAuthenticationOptions(userId?: string) {
    let allowCredentials;
    
    if (userId) {
      const user = await this.userStore.getUserById(userId);
      if (user) {
        allowCredentials = user.credentials.map(cred => ({
          id: cred.id,
          type: 'public-key' as const,
          transports: cred.transports,
        }));
      }
    }

    const opts: GenerateAuthenticationOptionsOpts = {
      timeout: this.config.timeout || 60000,
      allowCredentials,
      userVerification: this.config.userVerification || 'preferred',
      rpID: this.config.rpID,
    };

    const options = await generateAuthenticationOptions(opts);
    
    // Guardar el challenge para verificación posterior
    const challengeKey = userId ? `auth_${userId}` : `auth_${options.challenge}`;
    this.challengeStore.set(challengeKey, options.challenge);

    return options;
  }

  /**
   * Verifica la respuesta de autenticación con passkey
   */
  async verifyAuthentication(response: any, userId?: string): Promise<AuthenticationResult> {
    try {
      // Buscar el usuario y credencial
      let user: PasskeyUser | null = null;
      let credential: PasskeyCredential | undefined;

      if (userId) {
        // Búsqueda por userId (más eficiente)
        user = await this.userStore.getUserById(userId);
        if (!user) {
          return { verified: false, error: 'Usuario no encontrado' };
        }
        credential = user.credentials.find(cred => cred.id === response.id);
        if (!credential) {
          return { verified: false, error: 'Credencial no encontrada' };
        }
      } else {
        // Búsqueda por credential ID (resident keys / discoverable credentials)
        const result = await this.userStore.getUserByCredentialId(response.id);
        if (!result) {
          return { verified: false, error: 'Credencial no encontrada' };
        }
        user = result.user;
        credential = result.credential;
      }

      const challengeKey = userId ? `auth_${userId}` : `auth_${response.challenge || user.id}`;
      const expectedChallenge = this.challengeStore.get(challengeKey);
      if (!expectedChallenge) {
        return { verified: false, error: 'Challenge no encontrado o expirado' };
      }

      const opts: VerifyAuthenticationResponseOpts = {
        response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpID,
        credential: {
          id: credential.id,
          publicKey: new Uint8Array(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports,
        },
        requireUserVerification: this.config.userVerification === 'required',
      };

      const verification = await verifyAuthenticationResponse(opts);

      if (verification.verified) {
        // Actualizar contador y timestamp
        if (verification.authenticationInfo.newCounter !== credential.counter) {
          credential.counter = verification.authenticationInfo.newCounter;
        }
        credential.lastUsedAt = new Date();
        await this.userStore.updateUser(user);

        this.challengeStore.delete(challengeKey);
        return { verified: true, user, credential };
      }

      return { verified: false, error: 'Verificación de autenticación falló' };
    } catch (error) {
      return { verified: false, error: `Error en verificación: ${(error as Error).message}` };
    }
  }

  /**
   * Obtiene información del usuario por ID
   */
  async getUser(userId: string): Promise<PasskeyUser | null> {
    return this.userStore.getUserById(userId);
  }

  /**
   * Obtiene información del usuario por username
   */
  async getUserByUsername(username: string): Promise<PasskeyUser | null> {
    return this.userStore.getUserByUsername(username);
  }

  /**
   * Lista todas las credenciales de un usuario
   */
  async listCredentials(userId: string): Promise<PasskeyCredential[]> {
    const user = await this.userStore.getUserById(userId);
    return user?.credentials || [];
  }

  /**
   * Obtiene detalles de una credencial específica
   */
  async getCredential(userId: string, credentialId: string): Promise<PasskeyCredential | null> {
    const user = await this.userStore.getUserById(userId);
    if (!user) return null;

    const credential = user.credentials.find(cred => cred.id === credentialId);
    return credential || null;
  }

  /**
   * Elimina una credencial específica de un usuario
   */
  async removeCredential(userId: string, credentialId: string): Promise<boolean> {
    if (!this.userStore.removeCredential) {
      throw new Error('UserStore does not support removeCredential operation');
    }

    try {
      await this.userStore.removeCredential(userId, credentialId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Actualiza los metadatos de una credencial (nombre, etc.)
   */
  async updateCredentialMetadata(
    userId: string,
    credentialId: string,
    metadata: { name?: string }
  ): Promise<boolean> {
    const user = await this.userStore.getUserById(userId);
    if (!user) return false;

    const credential = user.credentials.find(cred => cred.id === credentialId);
    if (!credential) return false;

    // Actualizar metadatos
    if (metadata.name !== undefined) {
      credential.name = metadata.name;
    }

    await this.userStore.updateUser(user);
    return true;
  }

  /**
   * Cuenta el número de credenciales de un usuario
   */
  async countCredentials(userId: string): Promise<number> {
    const user = await this.userStore.getUserById(userId);
    return user?.credentials.length || 0;
  }
}