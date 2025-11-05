# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Advanced credential management system
  - `listCredentials()` - List all user credentials
  - `getCredential()` - Get specific credential details
  - `removeCredential()` - Delete a credential
  - `updateCredentialMetadata()` - Update credential name and metadata
  - `countCredentials()` - Count user credentials
- Database store implementations
  - MongoDB store with Mongoose
  - PostgreSQL store with pg
  - MySQL store with mysql2
- New Express endpoints for credential management
  - `GET /api/passkey/user/:userId/credentials` - List credentials
  - `GET /api/passkey/user/:userId/credentials/:credentialId` - Get credential
  - `DELETE /api/passkey/user/:userId/credentials/:credentialId` - Remove credential
  - `PATCH /api/passkey/user/:userId/credentials/:credentialId` - Update metadata
- Credential metadata support
  - `name` - Custom name for credentials
  - `createdAt` - Creation timestamp
  - `lastUsedAt` - Last usage timestamp
- Comprehensive test suite (55+ tests)
  - PasskeyAuth core tests
  - Store implementation tests
  - Express route tests
- GitHub Actions CI/CD pipeline
  - Multi-version Node.js testing (18.x, 20.x, 22.x)
  - Code coverage reporting
  - Security audit
  - Build verification
- Complete documentation
  - DATABASE_STORES.md for database implementations
  - CONTRIBUTING.md for contributors
  - Enhanced README with new features

### Changed
- Updated `@simplewebauthn` dependencies to v13.2.2
- Updated all dev dependencies to latest versions
- Improved `PasskeyAuth.verifyAuthentication()` to support resident keys
- Added `getUserByCredentialId()` to UserStore interface
- Enhanced credential tracking with automatic timestamp updates

### Fixed
- Missing `cors` dependency in package.json
- Credential ID lookup implementation (was throwing error)
- Type compatibility with @simplewebauthn v13.x API changes

## [1.0.0] - 2024-01-XX

### Added
- Initial release
- Core PasskeyAuth implementation
- Memory-based stores (MemoryChallengeStore, MemoryUserStore)
- Express.js integration
  - `createExpressRoutes()` - Automatic route creation
  - `createExpressMiddleware()` - Request middleware
- WebAuthn operations
  - Registration flow (begin/finish)
  - Authentication flow (begin/finish)
- Basic credential management
- TypeScript support with full type definitions
- Interactive demo application
- Comprehensive documentation in English and Spanish
- MIT License

### Supported Operations
- User registration with passkeys
- User authentication with passkeys
- Challenge generation and verification
- Credential storage and management
- Multi-device support
- Platform and cross-platform authenticators

---

## Upgrade Guide

### From 1.0.0 to Unreleased

#### Breaking Changes
None - All changes are backwards compatible.

#### New Features to Adopt

1. **Upgrade Dependencies**
   ```bash
   npm install @simplewebauthn/server@^13.2.2 @simplewebauthn/browser@^13.2.2
   ```

2. **Use Credential Management**
   ```typescript
   // List user credentials
   const credentials = await passkeyAuth.listCredentials(userId);

   // Remove a credential
   await passkeyAuth.removeCredential(userId, credentialId);

   // Update credential name
   await passkeyAuth.updateCredentialMetadata(userId, credentialId, {
     name: 'My iPhone'
   });
   ```

3. **Switch to Database Stores** (Recommended for production)
   ```typescript
   import { PostgreSQLUserStore } from 'passkey-auth-plugin';

   const userStore = new PostgreSQLUserStore(pgPool);
   await userStore.createTables();
   ```

4. **Add New Express Routes**
   The new credential management endpoints are automatically included when using `createExpressRoutes()`.

---

## Roadmap

### v1.1.0 (Planned)
- [ ] Conditional UI support (mediation: 'conditional')
- [ ] Credential usage analytics
- [ ] Rate limiting middleware
- [ ] Input validation utilities

### v1.2.0 (Planned)
- [ ] Next.js integration example
- [ ] Nuxt.js integration example
- [ ] Enhanced error messages
- [ ] Logging system

### v2.0.0 (Future)
- [ ] Plugin system for custom authenticators
- [ ] Advanced security features
- [ ] Performance optimizations
- [ ] Breaking API improvements

---

## Support

- 📚 [Documentation](https://github.com/eyrockscript/passkey-auth-plugin)
- 🐛 [Report Issues](https://github.com/eyrockscript/passkey-auth-plugin/issues)
- 💬 [Discussions](https://github.com/eyrockscript/passkey-auth-plugin/discussions)

[Unreleased]: https://github.com/eyrockscript/passkey-auth-plugin/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/eyrockscript/passkey-auth-plugin/releases/tag/v1.0.0
