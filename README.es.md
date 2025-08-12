# 🔐 Passkey Auth Plugin

*[Read this README in Spanish / Leer en Español](./README.es.md)*

Un plugin completo para integrar **passkeys (WebAuthn)** como método de autenticación sin contraseña en aplicaciones Node.js. Ideal para añadir autenticación biométrica después de una validación inicial de identidad.

[![npm version](https://badge.fury.io/js/passkey-auth-plugin.svg)](https://badge.fury.io/js/passkey-auth-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Características

- 🛡️ **Seguridad avanzada**: Resistente a phishing y ataques de fuerza bruta
- ⚡ **Experiencia fluida**: Login instantáneo con biometría, Face ID, Touch ID o PIN
- 🔑 **Sin contraseñas**: Elimina el riesgo de contraseñas débiles o comprometidas
- 🏗️ **Fácil integración**: APIs simples para Node.js y Express.js
- 📱 **Multi-dispositivo**: Soporte para autenticadores de plataforma y externos
- 🔄 **Stores personalizables**: Implementa tu propia persistencia de datos
- 🎯 **TypeScript**: Completamente tipado para mejor desarrollo

## 📦 Instalación

```bash
npm install passkey-auth-plugin
```

## 🚀 Uso Rápido

### Configuración Básica

```javascript
const { createPasskeyAuth } = require('passkey-auth-plugin');

// Configuración simple con stores en memoria
const passkeyAuth = createPasskeyAuth({
  rpName: 'Mi Aplicación',
  rpID: 'localhost', // Tu dominio en producción
  origin: 'http://localhost:3000', // Tu URL en producción
  timeout: 60000,
  userVerification: 'preferred'
});
```

### Con Express.js (Recomendado)

```javascript
const express = require('express');
const { createPasskeyAuth, createExpressRoutes } = require('passkey-auth-plugin');

const app = express();
app.use(express.json());

const passkeyAuth = createPasskeyAuth({
  rpName: 'Mi App',
  rpID: 'localhost',
  origin: 'http://localhost:3000'
});

// Añadir rutas automáticas
app.use('/api', createExpressRoutes(passkeyAuth));

app.listen(3000);
```

Las rutas automáticas incluyen:
- `POST /api/passkey/register/begin` - Iniciar registro de passkey
- `POST /api/passkey/register/finish` - Completar registro de passkey  
- `POST /api/passkey/authenticate/begin` - Iniciar autenticación
- `POST /api/passkey/authenticate/finish` - Completar autenticación
- `GET /api/passkey/user/:userId` - Obtener información de usuario

## 📖 Flujo de Uso Típico

### 1. Registro Inicial (Método Tradicional)
Primero, el usuario se registra con email/contraseña o cualquier método tradicional:

```javascript
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  // Validar credenciales, crear usuario en DB, etc.
  const userId = await createUserInDatabase(username, email, password);
  
  res.json({
    success: true,
    user: { id: userId, username, email },
    message: '¿Quieres configurar login sin contraseña?'
  });
});
```

### 2. Configurar Passkey (Opcional pero Recomendado)
Después del registro exitoso, ofrecer configurar passkey:

```javascript
// Frontend: Iniciar configuración de passkey
const setupPasskey = async (userId, username) => {
  // 1. Obtener opciones del servidor
  const response = await fetch('/api/passkey/register/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, username, displayName: username })
  });
  
  const options = await response.json();
  
  // 2. Crear credencial con WebAuthn
  const { startRegistration } = await import('@simplewebauthn/browser');
  const credential = await startRegistration(options);
  
  // 3. Completar registro
  const finishResponse = await fetch('/api/passkey/register/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, response: credential })
  });
  
  return finishResponse.json();
};
```

### 3. Login con Passkey
En futuros logins, el usuario puede usar su passkey:

```javascript
// Frontend: Login con passkey
const loginWithPasskey = async (userId) => {
  // 1. Obtener opciones de autenticación
  const response = await fetch('/api/passkey/authenticate/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }) // Opcional si usas resident keys
  });
  
  const options = await response.json();
  
  // 2. Autenticar con WebAuthn
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const credential = await startAuthentication(options);
  
  // 3. Verificar autenticación
  const finishResponse = await fetch('/api/passkey/authenticate/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, response: credential })
  });
  
  return finishResponse.json();
};
```

## 🛠️ API Detallada

### PasskeyAuth

La clase principal que maneja toda la lógica de WebAuthn:

```javascript
const { PasskeyAuth, MemoryUserStore, MemoryChallengeStore } = require('passkey-auth-plugin');

const passkeyAuth = new PasskeyAuth(config, userStore, challengeStore);
```

#### Métodos Principales

##### `generateRegistrationOptions(userId, username, displayName)`
Genera opciones para registrar un nuevo passkey.

```javascript
const options = await passkeyAuth.generateRegistrationOptions(
  'user123',
  'juan.perez', 
  'Juan Pérez'
);
// Enviar `options` al frontend para usar con WebAuthn
```

##### `verifyRegistration(userId, response)`
Verifica la respuesta de registro del cliente.

```javascript
const result = await passkeyAuth.verifyRegistration(userId, webAuthnResponse);
if (result.verified) {
  console.log('✅ Passkey registrado exitosamente');
} else {
  console.log('❌ Error:', result.error);
}
```

##### `generateAuthenticationOptions(userId?)`
Genera opciones para autenticación. `userId` es opcional si usas resident keys.

```javascript
const options = await passkeyAuth.generateAuthenticationOptions('user123');
// Enviar `options` al frontend
```

##### `verifyAuthentication(response, userId?)`
Verifica la respuesta de autenticación del cliente.

```javascript
const result = await passkeyAuth.verifyAuthentication(webAuthnResponse, userId);
if (result.verified) {
  console.log('✅ Usuario autenticado:', result.user);
} else {
  console.log('❌ Error:', result.error);
}
```

## 🗄️ Stores Personalizados

El plugin permite implementar tu propia persistencia de datos:

### UserStore Personalizado

```javascript
class DatabaseUserStore {
  async createUser(userData) {
    // Crear usuario en tu base de datos
    const user = await db.users.create(userData);
    return { ...user, credentials: [] };
  }

  async getUserById(id) {
    // Buscar usuario por ID
    return await db.users.findById(id);
  }

  async getUserByUsername(username) {
    // Buscar usuario por username
    return await db.users.findOne({ username });
  }

  async updateUser(user) {
    // Actualizar usuario
    return await db.users.update(user.id, user);
  }

  async addCredential(userId, credential) {
    // Añadir credencial a usuario
    await db.users.addCredential(userId, credential);
  }
}
```

### ChallengeStore Personalizado

```javascript
class RedisChallengeStore {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  set(key, value, ttl = 300000) {
    // Guardar challenge en Redis con TTL
    this.redis.setex(key, ttl / 1000, value);
  }

  get(key) {
    // Obtener challenge de Redis
    return this.redis.get(key);
  }

  delete(key) {
    // Eliminar challenge de Redis
    this.redis.del(key);
  }
}
```

Usar stores personalizados:

```javascript
const userStore = new DatabaseUserStore();
const challengeStore = new RedisChallengeStore(redisClient);

const passkeyAuth = new PasskeyAuth(config, userStore, challengeStore);
```

## 🔧 Configuración

### PasskeyConfig

```typescript
interface PasskeyConfig {
  rpName: string;                    // Nombre de tu aplicación
  rpID: string;                      // Tu dominio (ej: 'example.com')
  origin: string;                    // URL completa (ej: 'https://example.com')
  timeout?: number;                  // Timeout en ms (default: 60000)
  userVerification?: 'required' | 'preferred' | 'discouraged'; // default: 'preferred'
}
```

### Configuración de Producción

```javascript
const passkeyAuth = createPasskeyAuth({
  rpName: 'Mi App Productiva',
  rpID: 'miapp.com',
  origin: 'https://miapp.com',
  timeout: 120000, // 2 minutos
  userVerification: 'required' // Siempre requerir verificación
});
```

## 🌐 Compatibilidad de Navegadores

| Navegador | Versión Mínima | Soporte |
|-----------|----------------|---------|
| Chrome    | 67+            | ✅ Completo |
| Firefox   | 60+            | ✅ Completo |
| Safari    | 14+            | ✅ Completo |
| Edge      | 18+            | ✅ Completo |

### Verificar Soporte

```javascript
// Frontend: Verificar soporte de WebAuthn
if (!window.PublicKeyCredential) {
  console.log('❌ WebAuthn no soportado');
} else {
  console.log('✅ WebAuthn soportado');
}
```

## 📱 Demo Interactiva

El plugin incluye una demo completa que puedes ejecutar localmente:

```bash
# Construir el plugin
npm run build

# Ejecutar demo
cd examples
npm install
npm start
```

Visita `http://localhost:3000` para ver la demo interactiva.

## 🧪 Ejemplos Incluidos

- **`examples/server/basic-server.js`** - Servidor Express.js con rutas automáticas
- **`examples/server/advanced-example.js`** - Uso programático avanzado
- **`examples/demo/index.html`** - Demo visual interactiva
- **`examples/demo/app.js`** - Código frontend completo

## 🔒 Consideraciones de Seguridad

### En Producción:
- ✅ Usar HTTPS siempre
- ✅ Configurar `rpID` con tu dominio real
- ✅ Usar stores persistentes (Base de datos, Redis)
- ✅ Implementar rate limiting
- ✅ Validar origin en el servidor
- ✅ Usar `userVerification: 'required'` para mayor seguridad

### NO hacer:
- ❌ Usar HTTP en producción
- ❌ Exponer challenges o datos sensibles
- ❌ Confiar solo en validación del frontend
- ❌ Usar stores en memoria en producción

## 🤝 Contribuir

¡Las contribuciones son bienvenidas!

1. Fork el proyecto
2. Crear rama para nueva funcionalidad (`git checkout -b feature/amazing-feature`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Crear Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 🙋‍♂️ Soporte

- 📚 [Documentación completa](https://github.com/tuusuario/passkey-auth-plugin/wiki)
- 🐛 [Reportar bugs](https://github.com/tuusuario/passkey-auth-plugin/issues)
- 💬 [Discusiones](https://github.com/tuusuario/passkey-auth-plugin/discussions)

## 🎯 Roadmap

- [ ] Soporte para autenticación condicional
- [ ] Integración con frameworks populares (Next.js, Nuxt.js)
- [ ] Gestión avanzada de credenciales
- [ ] Métricas y analytics
- [ ] Plugin para bases de datos populares

---

**⭐ Si este proyecto te resulta útil, ¡dale una estrella en GitHub!**