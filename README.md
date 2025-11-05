# 🔐 Passkey Auth Plugin

*[Leer en Español / Read in Spanish](./README.es.md)*

**A complete, production-ready plugin to integrate passkeys (WebAuthn) as a passwordless authentication method in Node.js applications.** Add biometric authentication (Face ID, Touch ID, fingerprint) to your app in minutes.

[![npm version](https://img.shields.io/npm/v/passkey-auth-plugin.svg)](https://www.npmjs.com/package/passkey-auth-plugin)
[![npm downloads](https://img.shields.io/npm/dm/passkey-auth-plugin.svg)](https://www.npmjs.com/package/passkey-auth-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/eyrockscript/passkey-auth-plugin/workflows/CI/badge.svg)](https://github.com/eyrockscript/passkey-auth-plugin/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

---

## 🎯 What is this?

This plugin allows you to add **passwordless authentication** to your Node.js/Express applications using **WebAuthn passkeys**. Users can log in using:
- 🔐 Face ID / Touch ID (iOS/macOS)
- 👆 Fingerprint sensors (Android/Windows)
- 🔑 Security keys (YubiKey, etc.)
- 📱 Platform authenticators

**Perfect for:** SaaS applications, admin panels, e-commerce platforms, banking apps, or any application requiring secure, user-friendly authentication.

## ✨ Features

- 🛡️ **Advanced Security**: Resistant to phishing and brute force attacks
- ⚡ **Smooth Experience**: Instant login with biometrics, Face ID, Touch ID, or PIN
- 🔑 **Passwordless**: Eliminates the risk of weak or compromised passwords
- 🏗️ **Easy Integration**: Simple APIs for Node.js and Express.js
- 📱 **Multi-device**: Support for platform and external authenticators
- 🔄 **Customizable Stores**: Implement your own data persistence
- 🎯 **TypeScript**: Fully typed for better development experience

## 📦 Installation

```bash
npm install passkey-auth-plugin
```

## 🚀 Quick Start

### Basic Setup

```javascript
const { createPasskeyAuth } = require('passkey-auth-plugin');

// Simple configuration with in-memory stores
const passkeyAuth = createPasskeyAuth({
  rpName: 'My Application',
  rpID: 'localhost', // Your domain in production
  origin: 'http://localhost:3000', // Your URL in production
  timeout: 60000,
  userVerification: 'preferred'
});
```

### With Express.js (Recommended)

```javascript
const express = require('express');
const { createPasskeyAuth, createExpressRoutes } = require('passkey-auth-plugin');

const app = express();
app.use(express.json());

const passkeyAuth = createPasskeyAuth({
  rpName: 'My App',
  rpID: 'localhost',
  origin: 'http://localhost:3000'
});

// Add automatic routes
app.use('/api', createExpressRoutes(passkeyAuth));

app.listen(3000);
```

The automatic routes include:
- `POST /api/passkey/register/begin` - Start passkey registration
- `POST /api/passkey/register/finish` - Complete passkey registration
- `POST /api/passkey/authenticate/begin` - Start authentication
- `POST /api/passkey/authenticate/finish` - Complete authentication
- `GET /api/passkey/user/:userId` - Get user information
- `GET /api/passkey/user/:userId/credentials` - List all user credentials
- `GET /api/passkey/user/:userId/credentials/:credentialId` - Get specific credential details
- `DELETE /api/passkey/user/:userId/credentials/:credentialId` - Remove a credential
- `PATCH /api/passkey/user/:userId/credentials/:credentialId` - Update credential metadata (name)

## 📖 Typical Usage Flow

### 1. Initial Registration (Traditional Method)
First, the user registers with email/password or any traditional method:

```javascript
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  // Validate credentials, create user in DB, etc.
  const userId = await createUserInDatabase(username, email, password);
  
  res.json({
    success: true,
    user: { id: userId, username, email },
    message: 'Would you like to set up passwordless login?'
  });
});
```

### 2. Set Up Passkey (Optional but Recommended)
After successful registration, offer passkey setup:

```javascript
// Frontend: Start passkey setup
const setupPasskey = async (userId, username) => {
  // 1. Get options from server
  const response = await fetch('/api/passkey/register/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, username, displayName: username })
  });
  
  const options = await response.json();
  
  // 2. Create credential with WebAuthn
  const { startRegistration } = await import('@simplewebauthn/browser');
  const credential = await startRegistration(options);
  
  // 3. Complete registration
  const finishResponse = await fetch('/api/passkey/register/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, response: credential })
  });
  
  return finishResponse.json();
};
```

### 3. Login with Passkey
In future logins, the user can use their passkey:

```javascript
// Frontend: Login with passkey
const loginWithPasskey = async (userId) => {
  // 1. Get authentication options
  const response = await fetch('/api/passkey/authenticate/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }) // Optional if using resident keys
  });
  
  const options = await response.json();
  
  // 2. Authenticate with WebAuthn
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const credential = await startAuthentication(options);
  
  // 3. Verify authentication
  const finishResponse = await fetch('/api/passkey/authenticate/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, response: credential })
  });
  
  return finishResponse.json();
};
```

## 🛠️ Detailed API

### PasskeyAuth

The main class that handles all WebAuthn logic:

```javascript
const { PasskeyAuth, MemoryUserStore, MemoryChallengeStore } = require('passkey-auth-plugin');

const passkeyAuth = new PasskeyAuth(config, userStore, challengeStore);
```

#### Main Methods

##### `generateRegistrationOptions(userId, username, displayName)`
Generate options to register a new passkey.

```javascript
const options = await passkeyAuth.generateRegistrationOptions(
  'user123',
  'john.doe', 
  'John Doe'
);
// Send `options` to frontend for use with WebAuthn
```

##### `verifyRegistration(userId, response)`
Verify the registration response from the client.

```javascript
const result = await passkeyAuth.verifyRegistration(userId, webAuthnResponse);
if (result.verified) {
  console.log('✅ Passkey registered successfully');
} else {
  console.log('❌ Error:', result.error);
}
```

##### `generateAuthenticationOptions(userId?)`
Generate authentication options. `userId` is optional if using resident keys.

```javascript
const options = await passkeyAuth.generateAuthenticationOptions('user123');
// Send `options` to frontend
```

##### `verifyAuthentication(response, userId?)`
Verify the authentication response from the client.

```javascript
const result = await passkeyAuth.verifyAuthentication(webAuthnResponse, userId);
if (result.verified) {
  console.log('✅ User authenticated:', result.user);
} else {
  console.log('❌ Error:', result.error);
}
```

## 🗄️ Custom Stores

The plugin allows implementing your own data persistence:

### Custom UserStore

```javascript
class DatabaseUserStore {
  async createUser(userData) {
    // Create user in your database
    const user = await db.users.create(userData);
    return { ...user, credentials: [] };
  }

  async getUserById(id) {
    // Find user by ID
    return await db.users.findById(id);
  }

  async getUserByUsername(username) {
    // Find user by username
    return await db.users.findOne({ username });
  }

  async updateUser(user) {
    // Update user
    return await db.users.update(user.id, user);
  }

  async addCredential(userId, credential) {
    // Add credential to user
    await db.users.addCredential(userId, credential);
  }
}
```

### Custom ChallengeStore

```javascript
class RedisChallengeStore {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  set(key, value, ttl = 300000) {
    // Save challenge in Redis with TTL
    this.redis.setex(key, ttl / 1000, value);
  }

  get(key) {
    // Get challenge from Redis
    return this.redis.get(key);
  }

  delete(key) {
    // Delete challenge from Redis
    this.redis.del(key);
  }
}
```

Use custom stores:

```javascript
const userStore = new DatabaseUserStore();
const challengeStore = new RedisChallengeStore(redisClient);

const passkeyAuth = new PasskeyAuth(config, userStore, challengeStore);
```

## 🔧 Configuration

### PasskeyConfig

```typescript
interface PasskeyConfig {
  rpName: string;                    // Your application name
  rpID: string;                      // Your domain (e.g., 'example.com')
  origin: string;                    // Full URL (e.g., 'https://example.com')
  timeout?: number;                  // Timeout in ms (default: 60000)
  userVerification?: 'required' | 'preferred' | 'discouraged'; // default: 'preferred'
}
```

### Production Configuration

```javascript
const passkeyAuth = createPasskeyAuth({
  rpName: 'My Production App',
  rpID: 'myapp.com',
  origin: 'https://myapp.com',
  timeout: 120000, // 2 minutes
  userVerification: 'required' // Always require verification
});
```

## 🌐 Browser Compatibility

| Browser | Minimum Version | Support |
|---------|----------------|---------|
| Chrome  | 67+            | ✅ Full |
| Firefox | 60+            | ✅ Full |
| Safari  | 14+            | ✅ Full |
| Edge    | 18+            | ✅ Full |

### Check Support

```javascript
// Frontend: Check WebAuthn support
if (!window.PublicKeyCredential) {
  console.log('❌ WebAuthn not supported');
} else {
  console.log('✅ WebAuthn supported');
}
```

## 📱 Interactive Demo

The plugin includes a complete demo you can run locally:

```bash
# Clone the repository
git clone https://github.com/eyrockscript/passkey-auth-plugin.git
cd passkey-auth-plugin

# Install dependencies
npm install

# Build the project
npm run build

# Run the example server
node examples/server/basic-server.js
```

Visit `http://localhost:3000` to see the interactive demo.

## 🧪 Included Examples

- **`examples/server/basic-server.js`** - Express.js server with automatic routes
- **`examples/server/advanced-example.js`** - Advanced programmatic usage
- **`examples/demo/index.html`** - Interactive visual demo
- **`examples/demo/app.js`** - Complete frontend code

## 🔒 Security Considerations

### In Production:
- ✅ Always use HTTPS
- ✅ Configure `rpID` with your real domain
- ✅ Use persistent stores (Database, Redis)
- ✅ Implement rate limiting
- ✅ Validate origin on the server
- ✅ Use `userVerification: 'required'` for enhanced security

### DON'T:
- ❌ Use HTTP in production
- ❌ Expose challenges or sensitive data
- ❌ Rely only on frontend validation
- ❌ Use memory stores in production

## 🤝 Contributing

Contributions are welcome!

1. Fork the project
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Create Pull Request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support & Documentation

- 📚 [Database Stores Guide](./DATABASE_STORES.md)
- 📖 [Complete Documentation](https://github.com/eyrockscript/passkey-auth-plugin)
- 🐛 [Report Bugs](https://github.com/eyrockscript/passkey-auth-plugin/issues)
- 💬 [Discussions](https://github.com/eyrockscript/passkey-auth-plugin/discussions)
- 🤝 [Contributing Guide](./CONTRIBUTING.md)

## 🎯 Roadmap

### ✅ Completed (v1.1.0)
- ✅ Advanced credential management (list, delete, update, metadata)
- ✅ Popular database plugins (MongoDB, PostgreSQL, MySQL)
- ✅ Comprehensive test suite (55+ tests)
- ✅ CI/CD with GitHub Actions

### 🔜 Upcoming
- [ ] Support for conditional authentication (mediation: 'conditional')
- [ ] Integration examples (Next.js, Nuxt.js)
- [ ] Rate limiting middleware
- [ ] Enhanced analytics and logging
- [ ] Credential usage statistics

---

**⭐ If you find this project useful, give it a star on GitHub!**