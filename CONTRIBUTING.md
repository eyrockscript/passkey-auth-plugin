# 🤝 Contributing to Passkey Auth Plugin

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Messages](#commit-messages)

---

## 📜 Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code:

- Be respectful and inclusive
- Welcome newcomers and be patient
- Focus on what is best for the community
- Show empathy towards other community members

---

## 🎯 How Can I Contribute?

### Reporting Bugs

Before submitting a bug report:
- Check the [existing issues](https://github.com/eyrockscript/passkey-auth-plugin/issues)
- Update to the latest version to see if the issue persists

When reporting a bug, include:
- Clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Code samples if applicable
- Environment details (Node version, OS, etc.)

### Suggesting Enhancements

Enhancement suggestions are welcome! Please:
- Use a clear, descriptive title
- Provide a detailed description of the proposed feature
- Explain why this enhancement would be useful
- Include code examples if possible

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:
- `good first issue` - Simple issues perfect for beginners
- `help wanted` - Issues where we need community help

---

## 🛠️ Development Setup

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Git

### Setup Steps

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/passkey-auth-plugin.git
   cd passkey-auth-plugin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a branch**
   ```bash
   git checkout -b feature/my-new-feature
   # or
   git checkout -b fix/issue-123
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run tests**
   ```bash
   npm test
   ```

6. **Start developing!**
   ```bash
   # Watch mode for TypeScript
   npm run dev
   ```

---

## 📥 Pull Request Process

1. **Update your fork**
   ```bash
   git fetch upstream
   git merge upstream/main
   ```

2. **Make your changes**
   - Write clear, concise code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run build
   npm test
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/my-new-feature
   ```

6. **Create Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill out the PR template

### PR Requirements

- ✅ All tests must pass
- ✅ Code must be properly formatted
- ✅ New features must include tests
- ✅ Documentation must be updated
- ✅ No merge conflicts
- ✅ Descriptive PR title and description

---

## 💻 Coding Standards

### TypeScript

- Use TypeScript for all new code
- Provide proper type annotations
- Avoid `any` types when possible
- Use interfaces over types when possible

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas
- Maximum line length: 100 characters
- Use meaningful variable names

### Example

```typescript
// ✅ Good
interface UserConfig {
  username: string;
  displayName: string;
  isActive: boolean;
}

async function createUser(config: UserConfig): Promise<User> {
  const user = await userStore.createUser({
    username: config.username,
    displayName: config.displayName,
  });

  return user;
}

// ❌ Bad
function createUser(cfg: any) {
  const u = userStore.createUser({ username: cfg.username, displayName: cfg.displayName })
  return u
}
```

---

## 🧪 Testing Guidelines

### Writing Tests

- Write tests for all new features
- Update tests when modifying existing features
- Aim for high code coverage (>80%)
- Use descriptive test names

### Test Structure

```typescript
describe('Feature Name', () => {
  describe('method name', () => {
    it('should do something specific', () => {
      // Arrange
      const input = ...;
      const expected = ...;

      // Act
      const result = methodName(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/PasskeyAuth.test.ts
```

---

## 📝 Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(auth): add support for resident keys

Implement getUserByCredentialId to support authentication
without requiring userId. This enables true passwordless
authentication with discoverable credentials.

Closes #123
```

```
fix(stores): handle credential counter updates correctly

Previously, the counter was only updated on certain conditions.
Now it's always updated after successful authentication.
```

```
docs(readme): update installation instructions

Add instructions for database stores and improve examples.
```

---

## 🏷️ Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `question` - Further information is requested
- `wontfix` - This will not be worked on

---

## 📞 Getting Help

- 💬 [GitHub Discussions](https://github.com/eyrockscript/passkey-auth-plugin/discussions)
- 🐛 [Issue Tracker](https://github.com/eyrockscript/passkey-auth-plugin/issues)
- 📧 Contact the maintainers

---

## 🙏 Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort!

---

**Happy Coding! 🚀**
