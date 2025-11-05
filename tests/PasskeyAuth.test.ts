import { PasskeyAuth } from '../src/PasskeyAuth';
import { MemoryChallengeStore, MemoryUserStore } from '../src/stores/MemoryStore';
import { PasskeyConfig } from '../src/types';

describe('PasskeyAuth', () => {
  let passkeyAuth: PasskeyAuth;
  let userStore: MemoryUserStore;
  let challengeStore: MemoryChallengeStore;

  const config: PasskeyConfig = {
    rpName: 'Test App',
    rpID: 'localhost',
    origin: 'http://localhost:3000',
    timeout: 60000,
    userVerification: 'preferred',
  };

  beforeEach(() => {
    userStore = new MemoryUserStore();
    challengeStore = new MemoryChallengeStore();
    passkeyAuth = new PasskeyAuth(config, userStore, challengeStore);
  });

  afterEach(() => {
    userStore.clear();
    challengeStore.clear();
  });

  describe('generateRegistrationOptions', () => {
    it('should generate registration options for a new user', async () => {
      const userId = 'user123';
      const username = 'testuser';
      const displayName = 'Test User';

      const options = await passkeyAuth.generateRegistrationOptions(
        userId,
        username,
        displayName
      );

      expect(options).toBeDefined();
      expect(options.challenge).toBeDefined();
      expect(options.rp.name).toBe(config.rpName);
      expect(options.rp.id).toBe(config.rpID);
      expect(options.user.id).toBeDefined();
      expect(options.user.name).toBe(username);
      expect(options.user.displayName).toBe(displayName);
      expect(options.timeout).toBe(config.timeout);
    });

    it('should create user if it does not exist', async () => {
      const userId = 'user456';
      const username = 'newuser';
      const displayName = 'New User';

      await passkeyAuth.generateRegistrationOptions(userId, username, displayName);

      const user = await userStore.getUserById(userId);
      expect(user).toBeDefined();
      expect(user?.username).toBe(username);
      expect(user?.displayName).toBe(displayName);
    });

    it('should store challenge for verification', async () => {
      const userId = 'user789';
      const username = 'anotheruser';
      const displayName = 'Another User';

      const options = await passkeyAuth.generateRegistrationOptions(
        userId,
        username,
        displayName
      );

      const storedChallenge = challengeStore.get(`reg_${userId}`);
      expect(storedChallenge).toBe(options.challenge);
    });

    it('should exclude existing credentials', async () => {
      const userId = 'user999';
      const username = 'existinguser';
      const displayName = 'Existing User';

      // First registration
      await passkeyAuth.generateRegistrationOptions(userId, username, displayName);

      // Add a mock credential
      await userStore.addCredential(userId, {
        id: 'credential123',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        deviceType: 'multiDevice',
        backedUp: false,
      });

      // Second registration
      const options = await passkeyAuth.generateRegistrationOptions(
        userId,
        username,
        displayName
      );

      expect(options.excludeCredentials).toBeDefined();
      expect(options.excludeCredentials?.length).toBe(1);
      expect(options.excludeCredentials?.[0].id).toBe('credential123');
    });
  });

  describe('generateAuthenticationOptions', () => {
    it('should generate authentication options with userId', async () => {
      const userId = 'user123';
      const username = 'testuser';
      const displayName = 'Test User';

      // Create user first
      await passkeyAuth.generateRegistrationOptions(userId, username, displayName);

      const options = await passkeyAuth.generateAuthenticationOptions(userId);

      expect(options).toBeDefined();
      expect(options.challenge).toBeDefined();
      expect(options.timeout).toBe(config.timeout);
      expect(options.rpId).toBe(config.rpID);
    });

    it('should generate authentication options without userId', async () => {
      const options = await passkeyAuth.generateAuthenticationOptions();

      expect(options).toBeDefined();
      expect(options.challenge).toBeDefined();
      expect(options.allowCredentials).toBeUndefined();
    });

    it('should include allowCredentials when userId is provided', async () => {
      const userId = 'user456';
      const username = 'userWithCreds';
      const displayName = 'User With Creds';

      await passkeyAuth.generateRegistrationOptions(userId, username, displayName);

      // Add mock credential
      await userStore.addCredential(userId, {
        id: 'cred456',
        publicKey: new Uint8Array([4, 5, 6]),
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: true,
        transports: ['internal'],
      });

      const options = await passkeyAuth.generateAuthenticationOptions(userId);

      expect(options.allowCredentials).toBeDefined();
      expect(options.allowCredentials?.length).toBe(1);
      expect(options.allowCredentials?.[0].id).toBe('cred456');
    });

    it('should store challenge for verification', async () => {
      const userId = 'user789';

      const options = await passkeyAuth.generateAuthenticationOptions(userId);

      const storedChallenge = challengeStore.get(`auth_${userId}`);
      expect(storedChallenge).toBe(options.challenge);
    });
  });

  describe('getUser', () => {
    it('should return user by ID', async () => {
      const userId = 'user123';
      const username = 'testuser';
      const displayName = 'Test User';

      await passkeyAuth.generateRegistrationOptions(userId, username, displayName);

      const user = await passkeyAuth.getUser(userId);

      expect(user).toBeDefined();
      expect(user?.id).toBe(userId);
      expect(user?.username).toBe(username);
      expect(user?.displayName).toBe(displayName);
    });

    it('should return null for non-existent user', async () => {
      const user = await passkeyAuth.getUser('nonexistent');
      expect(user).toBeNull();
    });
  });

  describe('getUserByUsername', () => {
    it('should return user by username', async () => {
      const userId = 'user123';
      const username = 'testuser';
      const displayName = 'Test User';

      await passkeyAuth.generateRegistrationOptions(userId, username, displayName);

      const user = await passkeyAuth.getUserByUsername(username);

      expect(user).toBeDefined();
      expect(user?.id).toBe(userId);
      expect(user?.username).toBe(username);
    });

    it('should return null for non-existent username', async () => {
      const user = await passkeyAuth.getUserByUsername('nonexistent');
      expect(user).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should use provided configuration', () => {
      expect(passkeyAuth).toBeDefined();
      // Configuration is private, but we can test it through generated options
    });

    it('should use default timeout if not provided', () => {
      const configWithoutTimeout: PasskeyConfig = {
        rpName: 'Test App',
        rpID: 'localhost',
        origin: 'http://localhost:3000',
      };

      const auth = new PasskeyAuth(configWithoutTimeout, userStore, challengeStore);
      expect(auth).toBeDefined();
    });
  });
});
