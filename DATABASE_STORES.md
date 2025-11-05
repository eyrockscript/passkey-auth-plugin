# 🗄️ Database Stores

Passkey Auth Plugin incluye implementaciones de `UserStore` para bases de datos populares, permitiendo persistencia de datos en producción.

## 📦 Stores Disponibles

- **MongoDBUserStore** - Para MongoDB con Mongoose
- **PostgreSQLUserStore** - Para PostgreSQL con pg
- **MySQLUserStore** - Para MySQL/MariaDB con mysql2

---

## 🍃 MongoDB Store

### Instalación

```bash
npm install mongoose
```

### Uso

```typescript
import mongoose from 'mongoose';
import { PasskeyAuth, MongoDBUserStore, MemoryChallengeStore } from 'passkey-auth-plugin';

// Conectar a MongoDB
await mongoose.connect('mongodb://localhost:27017/myapp');

// Crear el store
const userStore = new MongoDBUserStore();
const challengeStore = new MemoryChallengeStore();

// Inicializar PasskeyAuth
const passkeyAuth = new PasskeyAuth({
  rpName: 'My App',
  rpID: 'localhost',
  origin: 'http://localhost:3000',
}, userStore, challengeStore);
```

### Esquema Automático

El store crea automáticamente el modelo con el siguiente esquema:

```javascript
{
  id: String (unique, indexed),
  username: String (unique, indexed),
  displayName: String,
  credentials: [{
    id: String,
    publicKey: Buffer,
    counter: Number,
    deviceType: String, // 'singleDevice' | 'multiDevice'
    backedUp: Boolean,
    transports: [String],
    name: String,
    createdAt: Date,
    lastUsedAt: Date
  }],
  timestamps: true
}
```

---

## 🐘 PostgreSQL Store

### Instalación

```bash
npm install pg
```

### Uso

```typescript
import { Pool } from 'pg';
import { PasskeyAuth, PostgreSQLUserStore, MemoryChallengeStore } from 'passkey-auth-plugin';

// Crear pool de conexiones
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'password',
});

// Crear el store
const userStore = new PostgreSQLUserStore(pool);
const challengeStore = new MemoryChallengeStore();

// Crear tablas (solo una vez)
await userStore.createTables();

// Inicializar PasskeyAuth
const passkeyAuth = new PasskeyAuth({
  rpName: 'My App',
  rpID: 'localhost',
  origin: 'http://localhost:3000',
}, userStore, challengeStore);
```

### Esquema SQL

Ejecuta esto manualmente o usa `await userStore.createTables()`:

```sql
CREATE TABLE passkey_users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE passkey_credentials (
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

CREATE INDEX idx_credentials_user_id ON passkey_credentials(user_id);
CREATE INDEX idx_users_username ON passkey_users(username);
```

---

## 🐬 MySQL Store

### Instalación

```bash
npm install mysql2
```

### Uso

```typescript
import mysql from 'mysql2/promise';
import { PasskeyAuth, MySQLUserStore, MemoryChallengeStore } from 'passkey-auth-plugin';

// Crear pool de conexiones
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'myapp',
  waitForConnections: true,
  connectionLimit: 10,
});

// Crear el store
const userStore = new MySQLUserStore(pool);
const challengeStore = new MemoryChallengeStore();

// Crear tablas (solo una vez)
await userStore.createTables();

// Inicializar PasskeyAuth
const passkeyAuth = new PasskeyAuth({
  rpName: 'My App',
  rpID: 'localhost',
  origin: 'http://localhost:3000',
}, userStore, challengeStore);
```

### Esquema SQL

Ejecuta esto manualmente o usa `await userStore.createTables()`:

```sql
CREATE TABLE passkey_users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE passkey_credentials (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 🔧 Challenge Store para Producción

Para ambientes de producción, recomendamos usar Redis para el `ChallengeStore`:

### Redis Challenge Store (Ejemplo)

```typescript
import { createClient } from 'redis';
import { ChallengeStore } from 'passkey-auth-plugin';

class RedisChallengeStore implements ChallengeStore {
  private client: ReturnType<typeof createClient>;

  constructor(redisClient: ReturnType<typeof createClient>) {
    this.client = redisClient;
  }

  set(key: string, value: string, ttl: number = 300000): void {
    // TTL en segundos
    this.client.setEx(key, Math.floor(ttl / 1000), value);
  }

  async get(key: string): Promise<string | undefined> {
    const value = await this.client.get(key);
    return value || undefined;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}

// Uso
const redisClient = createClient({ url: 'redis://localhost:6379' });
await redisClient.connect();

const challengeStore = new RedisChallengeStore(redisClient);
```

---

## 📊 Comparación de Stores

| Feature | MongoDB | PostgreSQL | MySQL | Memory |
|---------|---------|------------|-------|--------|
| Persistencia | ✅ | ✅ | ✅ | ❌ |
| Transacciones | ⚠️ (limitadas) | ✅ | ✅ | N/A |
| Escalabilidad | ✅ Alta | ✅ Alta | ✅ Alta | ❌ Baja |
| Setup Complexity | 🟡 Media | 🟡 Media | 🟡 Media | 🟢 Baja |
| Búsqueda | ✅ | ✅ | ✅ | ✅ |
| Índices | ✅ Automático | ✅ Manual/Auto | ✅ Manual/Auto | ✅ Automático |

---

## 🏭 Configuración Completa en Producción

### Con Express + PostgreSQL + Redis

```typescript
import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import {
  PasskeyAuth,
  PostgreSQLUserStore,
  createExpressRoutes
} from 'passkey-auth-plugin';

// PostgreSQL
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }, // para producción
});

// Redis
const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

// Stores
const userStore = new PostgreSQLUserStore(pgPool);
await userStore.createTables();

const challengeStore = new RedisChallengeStore(redisClient);

// PasskeyAuth
const passkeyAuth = new PasskeyAuth({
  rpName: 'Production App',
  rpID: 'myapp.com',
  origin: 'https://myapp.com',
  timeout: 120000,
  userVerification: 'required',
}, userStore, challengeStore);

// Express
const app = express();
app.use(express.json());
app.use('/api', createExpressRoutes(passkeyAuth));

app.listen(3000, () => {
  console.log('🚀 Server running on port 3000');
});
```

---

## 🛠️ Crear Tu Propio Store

Implementa la interfaz `UserStore`:

```typescript
import { UserStore, PasskeyUser, PasskeyCredential } from 'passkey-auth-plugin';

export class MyCustomUserStore implements UserStore {
  async createUser(user: Omit<PasskeyUser, 'credentials'>): Promise<PasskeyUser> {
    // Tu implementación
  }

  async getUserById(id: string): Promise<PasskeyUser | null> {
    // Tu implementación
  }

  async getUserByUsername(username: string): Promise<PasskeyUser | null> {
    // Tu implementación
  }

  async getUserByCredentialId(credentialId: string): Promise<{ user: PasskeyUser; credential: PasskeyCredential } | null> {
    // Tu implementación
  }

  async updateUser(user: PasskeyUser): Promise<PasskeyUser> {
    // Tu implementación
  }

  async addCredential(userId: string, credential: PasskeyCredential): Promise<void> {
    // Tu implementación
  }

  async removeCredential(userId: string, credentialId: string): Promise<void> {
    // Tu implementación (opcional)
  }
}
```

---

## 🔐 Consideraciones de Seguridad

1. **Conexiones Seguras**: Usa SSL/TLS para conexiones de base de datos en producción
2. **Credenciales**: Nunca hardcodees contraseñas, usa variables de entorno
3. **Backups**: Configura backups automáticos de tu base de datos
4. **Monitoreo**: Implementa logging y monitoring de operaciones críticas
5. **Rate Limiting**: Protege tus endpoints con rate limiting
6. **Índices**: Asegúrate de tener índices en campos de búsqueda frecuente

---

## 📚 Recursos Adicionales

- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [node-postgres Documentation](https://node-postgres.com/)
- [mysql2 Documentation](https://github.com/sidorares/node-mysql2)
- [Redis Documentation](https://redis.io/docs/)

---

**¿Necesitas ayuda?** [Crea un issue](https://github.com/eyrockscript/passkey-auth-plugin/issues)
