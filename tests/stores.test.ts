import { MemoryChallengeStore, MemoryUserStore } from '../src/stores/MemoryStore';
import { PasskeyUser, PasskeyCredential } from '../src/types';

describe('MemoryChallengeStore', () => {
  let store: MemoryChallengeStore;

  beforeEach(() => {
    store = new MemoryChallengeStore();
  });

  afterEach(() => {
    store.clear();
  });

  describe('set and get', () => {
    it('should store and retrieve a challenge', () => {
      const key = 'test_key';
      const value = 'test_challenge_value';

      store.set(key, value);
      const retrieved = store.get(key);

      expect(retrieved).toBe(value);
    });

    it('should return undefined for non-existent key', () => {
      const retrieved = store.get('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('should update existing challenge', () => {
      const key = 'test_key';
      const value1 = 'challenge1';
      const value2 = 'challenge2';

      store.set(key, value1);
      store.set(key, value2);

      const retrieved = store.get(key);
      expect(retrieved).toBe(value2);
    });
  });

  describe('delete', () => {
    it('should delete a challenge', () => {
      const key = 'test_key';
      const value = 'test_value';

      store.set(key, value);
      store.delete(key);

      const retrieved = store.get(key);
      expect(retrieved).toBeUndefined();
    });

    it('should not throw when deleting non-existent key', () => {
      expect(() => store.delete('nonexistent')).not.toThrow();
    });
  });

  describe('TTL functionality', () => {
    it('should auto-delete challenge after TTL', async () => {
      const key = 'ttl_test';
      const value = 'ttl_value';
      const ttl = 100; // 100ms

      store.set(key, value, ttl);

      // Should exist immediately
      expect(store.get(key)).toBe(value);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be deleted
      expect(store.get(key)).toBeUndefined();
    }, 10000);

    it('should clear old timeout when updating key', async () => {
      const key = 'timeout_test';
      const value1 = 'value1';
      const value2 = 'value2';
      const ttl = 100;

      store.set(key, value1, ttl);
      await new Promise(resolve => setTimeout(resolve, 50));
      store.set(key, value2, ttl);
      await new Promise(resolve => setTimeout(resolve, 70));

      // Should still exist because timeout was reset
      expect(store.get(key)).toBe(value2);

      // Wait for new TTL to expire
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(store.get(key)).toBeUndefined();
    }, 10000);
  });

  describe('clear', () => {
    it('should clear all challenges', () => {
      store.set('key1', 'value1');
      store.set('key2', 'value2');
      store.set('key3', 'value3');

      store.clear();

      expect(store.get('key1')).toBeUndefined();
      expect(store.get('key2')).toBeUndefined();
      expect(store.get('key3')).toBeUndefined();
    });

    it('should clear all timeouts', async () => {
      store.set('key1', 'value1', 100);
      store.set('key2', 'value2', 100);

      store.clear();

      // Wait to ensure timeouts were cleared
      await new Promise(resolve => setTimeout(resolve, 150));

      // These gets should return undefined because store was cleared, not because timeout expired
      expect(store.get('key1')).toBeUndefined();
      expect(store.get('key2')).toBeUndefined();
    }, 10000);
  });
});

describe('MemoryUserStore', () => {
  let store: MemoryUserStore;

  beforeEach(() => {
    store = new MemoryUserStore();
  });

  afterEach(() => {
    store.clear();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = {
        id: 'user123',
        username: 'testuser',
        displayName: 'Test User',
      };

      const user = await store.createUser(userData);

      expect(user.id).toBe(userData.id);
      expect(user.username).toBe(userData.username);
      expect(user.displayName).toBe(userData.displayName);
      expect(user.credentials).toEqual([]);
    });

    it('should store user in memory', async () => {
      const userData = {
        id: 'user456',
        username: 'anotheruser',
        displayName: 'Another User',
      };

      await store.createUser(userData);
      const retrieved = await store.getUserById('user456');

      expect(retrieved).toBeDefined();
      expect(retrieved?.username).toBe(userData.username);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      await store.createUser({
        id: 'user123',
        username: 'testuser',
        displayName: 'Test User',
      });

      const user = await store.getUserById('user123');

      expect(user).toBeDefined();
      expect(user?.id).toBe('user123');
    });

    it('should return null for non-existent user', async () => {
      const user = await store.getUserById('nonexistent');
      expect(user).toBeNull();
    });
  });

  describe('getUserByUsername', () => {
    it('should return user by username', async () => {
      await store.createUser({
        id: 'user123',
        username: 'testuser',
        displayName: 'Test User',
      });

      const user = await store.getUserByUsername('testuser');

      expect(user).toBeDefined();
      expect(user?.id).toBe('user123');
    });

    it('should return null for non-existent username', async () => {
      const user = await store.getUserByUsername('nonexistent');
      expect(user).toBeNull();
    });
  });

  describe('getUserByCredentialId', () => {
    it('should return user and credential by credential ID', async () => {
      const userId = 'user123';
      await store.createUser({
        id: userId,
        username: 'testuser',
        displayName: 'Test User',
      });

      const credential: PasskeyCredential = {
        id: 'cred123',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        deviceType: 'multiDevice',
        backedUp: false,
      };

      await store.addCredential(userId, credential);

      const result = await store.getUserByCredentialId('cred123');

      expect(result).toBeDefined();
      expect(result?.user.id).toBe(userId);
      expect(result?.credential.id).toBe('cred123');
    });

    it('should return null for non-existent credential', async () => {
      const result = await store.getUserByCredentialId('nonexistent');
      expect(result).toBeNull();
    });

    it('should find credential across multiple users', async () => {
      await store.createUser({ id: 'user1', username: 'user1', displayName: 'User 1' });
      await store.createUser({ id: 'user2', username: 'user2', displayName: 'User 2' });

      await store.addCredential('user1', {
        id: 'cred1',
        publicKey: new Uint8Array([1]),
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: true,
      });

      await store.addCredential('user2', {
        id: 'cred2',
        publicKey: new Uint8Array([2]),
        counter: 0,
        deviceType: 'multiDevice',
        backedUp: false,
      });

      const result1 = await store.getUserByCredentialId('cred1');
      const result2 = await store.getUserByCredentialId('cred2');

      expect(result1?.user.id).toBe('user1');
      expect(result2?.user.id).toBe('user2');
    });
  });

  describe('updateUser', () => {
    it('should update user information', async () => {
      const user = await store.createUser({
        id: 'user123',
        username: 'testuser',
        displayName: 'Test User',
      });

      user.displayName = 'Updated Name';
      await store.updateUser(user);

      const updated = await store.getUserById('user123');
      expect(updated?.displayName).toBe('Updated Name');
    });
  });

  describe('addCredential', () => {
    it('should add credential to user', async () => {
      await store.createUser({
        id: 'user123',
        username: 'testuser',
        displayName: 'Test User',
      });

      const credential: PasskeyCredential = {
        id: 'cred123',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        deviceType: 'multiDevice',
        backedUp: false,
      };

      await store.addCredential('user123', credential);

      const user = await store.getUserById('user123');
      expect(user?.credentials.length).toBe(1);
      expect(user?.credentials[0].id).toBe('cred123');
    });

    it('should update existing credential with same ID', async () => {
      await store.createUser({
        id: 'user123',
        username: 'testuser',
        displayName: 'Test User',
      });

      const credential1: PasskeyCredential = {
        id: 'cred123',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        deviceType: 'multiDevice',
        backedUp: false,
      };

      const credential2: PasskeyCredential = {
        id: 'cred123',
        publicKey: new Uint8Array([4, 5, 6]),
        counter: 5,
        deviceType: 'singleDevice',
        backedUp: true,
      };

      await store.addCredential('user123', credential1);
      await store.addCredential('user123', credential2);

      const user = await store.getUserById('user123');
      expect(user?.credentials.length).toBe(1);
      expect(user?.credentials[0].counter).toBe(5);
    });

    it('should throw error for non-existent user', async () => {
      const credential: PasskeyCredential = {
        id: 'cred123',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        deviceType: 'multiDevice',
        backedUp: false,
      };

      await expect(store.addCredential('nonexistent', credential)).rejects.toThrow();
    });
  });

  describe('removeCredential', () => {
    it('should remove credential from user', async () => {
      await store.createUser({
        id: 'user123',
        username: 'testuser',
        displayName: 'Test User',
      });

      const credential: PasskeyCredential = {
        id: 'cred123',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        deviceType: 'multiDevice',
        backedUp: false,
      };

      await store.addCredential('user123', credential);
      await store.removeCredential('user123', 'cred123');

      const user = await store.getUserById('user123');
      expect(user?.credentials.length).toBe(0);
    });

    it('should throw error for non-existent user', async () => {
      await expect(store.removeCredential('nonexistent', 'cred123')).rejects.toThrow();
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      await store.createUser({ id: 'user1', username: 'user1', displayName: 'User 1' });
      await store.createUser({ id: 'user2', username: 'user2', displayName: 'User 2' });
      await store.createUser({ id: 'user3', username: 'user3', displayName: 'User 3' });

      const users = await store.getAllUsers();

      expect(users.length).toBe(3);
      expect(users.map(u => u.id)).toContain('user1');
      expect(users.map(u => u.id)).toContain('user2');
      expect(users.map(u => u.id)).toContain('user3');
    });

    it('should return empty array when no users', async () => {
      const users = await store.getAllUsers();
      expect(users).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all users and indices', async () => {
      await store.createUser({ id: 'user1', username: 'user1', displayName: 'User 1' });
      await store.createUser({ id: 'user2', username: 'user2', displayName: 'User 2' });

      store.clear();

      const users = await store.getAllUsers();
      const user1 = await store.getUserById('user1');
      const userByName = await store.getUserByUsername('user1');

      expect(users).toEqual([]);
      expect(user1).toBeNull();
      expect(userByName).toBeNull();
    });
  });
});
