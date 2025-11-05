import { PasskeyUser, PasskeyCredential, UserStore } from '../../types';

/**
 * MySQL UserStore implementation using mysql2 library
 *
 * @example
 * ```typescript
 * import mysql from 'mysql2/promise';
 * import { MySQLUserStore } from 'passkey-auth-plugin/stores/database/MySQLStore';
 *
 * const pool = mysql.createPool({
 *   host: 'localhost',
 *   user: 'root',
 *   password: 'password',
 *   database: 'myapp',
 *   waitForConnections: true,
 *   connectionLimit: 10,
 * });
 *
 * const userStore = new MySQLUserStore(pool);
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
 *   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *   INDEX idx_username (username)
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 *
 * CREATE TABLE passkey_credentials (
 *   id VARCHAR(255) PRIMARY KEY,
 *   user_id VARCHAR(255) NOT NULL,
 *   public_key BLOB NOT NULL,
 *   counter INT NOT NULL,
 *   device_type VARCHAR(50) NOT NULL,
 *   backed_up BOOLEAN NOT NULL,
 *   transports JSON,
 *   name VARCHAR(255),
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *   FOREIGN KEY (user_id) REFERENCES passkey_users(id) ON DELETE CASCADE,
 *   INDEX idx_user_id (user_id)
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 * ```
 */
export class MySQLUserStore implements UserStore {
  private pool: any;

  constructor(mysqlPool: any) {
    if (!mysqlPool) {
      throw new Error('MySQL Pool is required for MySQLUserStore');
    }
    this.pool = mysqlPool;
  }

  /**
   * Crea las tablas necesarias en la base de datos
   */
  async createTables(): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS passkey_users (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS passkey_credentials (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          public_key BLOB NOT NULL,
          counter INT NOT NULL,
          device_type VARCHAR(50) NOT NULL,
          backed_up BOOLEAN NOT NULL,
          transports JSON,
          name VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES passkey_users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } finally {
      connection.release();
    }
  }

  async createUser(userData: Omit<PasskeyUser, 'credentials'>): Promise<PasskeyUser> {
    await this.pool.query(
      'INSERT INTO passkey_users (id, username, display_name) VALUES (?, ?, ?)',
      [userData.id, userData.username, userData.displayName]
    );

    return {
      id: userData.id,
      username: userData.username,
      displayName: userData.displayName,
      credentials: [],
    };
  }

  async getUserById(id: string): Promise<PasskeyUser | null> {
    const [userRows] = await this.pool.query(
      'SELECT * FROM passkey_users WHERE id = ?',
      [id]
    );

    if (userRows.length === 0) return null;

    const [credentialRows] = await this.pool.query(
      'SELECT * FROM passkey_credentials WHERE user_id = ?',
      [id]
    );

    return this.rowsToUser(userRows[0], credentialRows);
  }

  async getUserByUsername(username: string): Promise<PasskeyUser | null> {
    const [userRows] = await this.pool.query(
      'SELECT * FROM passkey_users WHERE username = ?',
      [username]
    );

    if (userRows.length === 0) return null;

    const [credentialRows] = await this.pool.query(
      'SELECT * FROM passkey_credentials WHERE user_id = ?',
      [userRows[0].id]
    );

    return this.rowsToUser(userRows[0], credentialRows);
  }

  async getUserByCredentialId(credentialId: string): Promise<{ user: PasskeyUser; credential: PasskeyCredential } | null> {
    const [rows] = await this.pool.query(
      `SELECT u.*, c.* FROM passkey_users u
       JOIN passkey_credentials c ON u.id = c.user_id
       WHERE c.id = ?`,
      [credentialId]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    const credential = this.rowToCredential(row);

    const [allCredentials] = await this.pool.query(
      'SELECT * FROM passkey_credentials WHERE user_id = ?',
      [row.user_id]
    );

    const user = this.rowsToUser(
      {
        id: row.user_id,
        username: row.username,
        display_name: row.display_name,
      },
      allCredentials
    );

    return { user, credential };
  }

  async updateUser(user: PasskeyUser): Promise<PasskeyUser> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // Actualizar usuario
      await connection.query(
        'UPDATE passkey_users SET username = ?, display_name = ? WHERE id = ?',
        [user.username, user.displayName, user.id]
      );

      // Actualizar credenciales (estrategia simple: eliminar y reinsertar)
      await connection.query('DELETE FROM passkey_credentials WHERE user_id = ?', [user.id]);

      for (const cred of user.credentials) {
        await connection.query(
          `INSERT INTO passkey_credentials
           (id, user_id, public_key, counter, device_type, backed_up, transports, name, created_at, last_used_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

      await connection.commit();
      return user;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async addCredential(userId: string, credential: PasskeyCredential): Promise<void> {
    // Verificar si ya existe
    const [existing] = await this.pool.query(
      'SELECT id FROM passkey_credentials WHERE id = ? AND user_id = ?',
      [credential.id, userId]
    );

    if (existing.length > 0) {
      // Actualizar
      await this.pool.query(
        `UPDATE passkey_credentials
         SET public_key = ?, counter = ?, device_type = ?, backed_up = ?,
             transports = ?, name = ?, last_used_at = ?
         WHERE id = ? AND user_id = ?`,
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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      'DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?',
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
      backedUp: row.backed_up === 1 || row.backed_up === true,
      transports: row.transports ? JSON.parse(row.transports) : [],
      name: row.name,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    };
  }
}
