import { PasskeyUser, PasskeyCredential, UserStore } from '../../types';

/**
 * PostgreSQL UserStore implementation using pg library
 *
 * @example
 * ```typescript
 * import { Pool } from 'pg';
 * import { PostgreSQLUserStore } from 'passkey-auth-plugin/stores/database/PostgreSQLStore';
 *
 * const pool = new Pool({
 *   host: 'localhost',
 *   database: 'myapp',
 *   user: 'user',
 *   password: 'password',
 * });
 *
 * const userStore = new PostgreSQLUserStore(pool);
 * await userStore.createTables(); // Initialize tables
 * ```
 *
 * SQL Schema:
 * ```sql
 * CREATE TABLE passkey_users (
 *   id VARCHAR(255) PRIMARY KEY,
 *   username VARCHAR(255) UNIQUE NOT NULL,
 *   display_name VARCHAR(255) NOT NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 *
 * CREATE TABLE passkey_credentials (
 *   id VARCHAR(255) PRIMARY KEY,
 *   user_id VARCHAR(255) NOT NULL REFERENCES passkey_users(id) ON DELETE CASCADE,
 *   public_key BYTEA NOT NULL,
 *   counter INTEGER NOT NULL,
 *   device_type VARCHAR(50) NOT NULL,
 *   backed_up BOOLEAN NOT NULL,
 *   transports JSONB,
 *   name VARCHAR(255),
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 *
 * CREATE INDEX idx_credentials_user_id ON passkey_credentials(user_id);
 * CREATE INDEX idx_users_username ON passkey_users(username);
 * ```
 */
export class PostgreSQLUserStore implements UserStore {
  private pool: any;

  constructor(pgPool: any) {
    if (!pgPool) {
      throw new Error('PostgreSQL Pool is required for PostgreSQLUserStore');
    }
    this.pool = pgPool;
  }

  /**
   * Crea las tablas necesarias en la base de datos
   */
  async createTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS passkey_users (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS passkey_credentials (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL REFERENCES passkey_users(id) ON DELETE CASCADE,
          public_key BYTEA NOT NULL,
          counter INTEGER NOT NULL,
          device_type VARCHAR(50) NOT NULL,
          backed_up BOOLEAN NOT NULL,
          transports JSONB,
          name VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON passkey_credentials(user_id);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_username ON passkey_users(username);
      `);
    } finally {
      client.release();
    }
  }

  async createUser(userData: Omit<PasskeyUser, 'credentials'>): Promise<PasskeyUser> {
    const result = await this.pool.query(
      'INSERT INTO passkey_users (id, username, display_name) VALUES ($1, $2, $3) RETURNING *',
      [userData.id, userData.username, userData.displayName]
    );

    return {
      id: result.rows[0].id,
      username: result.rows[0].username,
      displayName: result.rows[0].display_name,
      credentials: [],
    };
  }

  async getUserById(id: string): Promise<PasskeyUser | null> {
    const userResult = await this.pool.query(
      'SELECT * FROM passkey_users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) return null;

    const credentialsResult = await this.pool.query(
      'SELECT * FROM passkey_credentials WHERE user_id = $1',
      [id]
    );

    return this.rowsToUser(userResult.rows[0], credentialsResult.rows);
  }

  async getUserByUsername(username: string): Promise<PasskeyUser | null> {
    const userResult = await this.pool.query(
      'SELECT * FROM passkey_users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) return null;

    const credentialsResult = await this.pool.query(
      'SELECT * FROM passkey_credentials WHERE user_id = $1',
      [userResult.rows[0].id]
    );

    return this.rowsToUser(userResult.rows[0], credentialsResult.rows);
  }

  async getUserByCredentialId(credentialId: string): Promise<{ user: PasskeyUser; credential: PasskeyCredential } | null> {
    const result = await this.pool.query(
      `SELECT u.*, c.* FROM passkey_users u
       JOIN passkey_credentials c ON u.id = c.user_id
       WHERE c.id = $1`,
      [credentialId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const credential = this.rowToCredential(row);

    const allCredentials = await this.pool.query(
      'SELECT * FROM passkey_credentials WHERE user_id = $1',
      [row.user_id]
    );

    const user = this.rowsToUser(
      {
        id: row.user_id,
        username: row.username,
        display_name: row.display_name,
      },
      allCredentials.rows
    );

    return { user, credential };
  }

  async updateUser(user: PasskeyUser): Promise<PasskeyUser> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Actualizar usuario
      await client.query(
        'UPDATE passkey_users SET username = $1, display_name = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [user.username, user.displayName, user.id]
      );

      // Actualizar credenciales (estrategia simple: eliminar y reinsertar)
      await client.query('DELETE FROM passkey_credentials WHERE user_id = $1', [user.id]);

      for (const cred of user.credentials) {
        await client.query(
          `INSERT INTO passkey_credentials
           (id, user_id, public_key, counter, device_type, backed_up, transports, name, created_at, last_used_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            cred.id,
            user.id,
            Buffer.from(cred.publicKey),
            cred.counter,
            cred.deviceType,
            cred.backedUp,
            JSON.stringify(cred.transports || []),
            cred.name,
            cred.createdAt || new Date(),
            cred.lastUsedAt || new Date(),
          ]
        );
      }

      await client.query('COMMIT');
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async addCredential(userId: string, credential: PasskeyCredential): Promise<void> {
    // Verificar si ya existe
    const existing = await this.pool.query(
      'SELECT id FROM passkey_credentials WHERE id = $1 AND user_id = $2',
      [credential.id, userId]
    );

    if (existing.rows.length > 0) {
      // Actualizar
      await this.pool.query(
        `UPDATE passkey_credentials
         SET public_key = $1, counter = $2, device_type = $3, backed_up = $4,
             transports = $5, name = $6, last_used_at = $7
         WHERE id = $8 AND user_id = $9`,
        [
          Buffer.from(credential.publicKey),
          credential.counter,
          credential.deviceType,
          credential.backedUp,
          JSON.stringify(credential.transports || []),
          credential.name,
          credential.lastUsedAt || new Date(),
          credential.id,
          userId,
        ]
      );
    } else {
      // Insertar
      await this.pool.query(
        `INSERT INTO passkey_credentials
         (id, user_id, public_key, counter, device_type, backed_up, transports, name, created_at, last_used_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          credential.id,
          userId,
          Buffer.from(credential.publicKey),
          credential.counter,
          credential.deviceType,
          credential.backedUp,
          JSON.stringify(credential.transports || []),
          credential.name,
          credential.createdAt || new Date(),
          credential.lastUsedAt || new Date(),
        ]
      );
    }
  }

  async removeCredential(userId: string, credentialId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM passkey_credentials WHERE id = $1 AND user_id = $2',
      [credentialId, userId]
    );
  }

  private rowsToUser(userRow: any, credentialRows: any[]): PasskeyUser {
    return {
      id: userRow.id,
      username: userRow.username,
      displayName: userRow.display_name,
      credentials: credentialRows.map(row => this.rowToCredential(row)),
    };
  }

  private rowToCredential(row: any): PasskeyCredential {
    return {
      id: row.id,
      publicKey: new Uint8Array(row.public_key),
      counter: row.counter,
      deviceType: row.device_type,
      backedUp: row.backed_up,
      transports: row.transports || [],
      name: row.name,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    };
  }
}
