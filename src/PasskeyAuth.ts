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
        const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
        
        const credential: PasskeyCredential = {
          id: credentialID,
          publicKey: credentialPublicKey,
          counter,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: response.response.transports,
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
      // Buscar el usuario por credential ID si no se proporciona userId
      let user: PasskeyUser | null = null;
      let credential: PasskeyCredential | undefined;

      if (userId) {
        user = await this.userStore.getUserById(userId);
      } else {
        // Buscar en todos los usuarios por credential ID
        // Esta es una implementación simplificada - en producción sería más eficiente
        throw new Error('Búsqueda por credential ID no implementada en esta versión');
      }

      if (!user) {
        return { verified: false, error: 'Usuario no encontrado' };
      }

      credential = user.credentials.find(cred => cred.id === response.id);
      if (!credential) {
        return { verified: false, error: 'Credencial no encontrada' };
      }

      const challengeKey = `auth_${userId}`;
      const expectedChallenge = this.challengeStore.get(challengeKey);
      if (!expectedChallenge) {
        return { verified: false, error: 'Challenge no encontrado o expirado' };
      }

      const opts: VerifyAuthenticationResponseOpts = {
        response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpID,
        authenticator: {
          credentialID: credential.id,
          credentialPublicKey: credential.publicKey,
          counter: credential.counter,
          transports: credential.transports,
        },
        requireUserVerification: this.config.userVerification === 'required',
      };

      const verification = await verifyAuthenticationResponse(opts);
      
      if (verification.verified) {
        // Actualizar contador si cambió
        if (verification.authenticationInfo.newCounter !== credential.counter) {
          credential.counter = verification.authenticationInfo.newCounter;
          await this.userStore.updateUser(user);
        }

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
}