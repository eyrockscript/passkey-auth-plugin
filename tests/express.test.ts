import express, { Express } from 'express';
import request from 'supertest';
import { createPasskeyAuth } from '../src/index';
import { createExpressRoutes, createExpressMiddleware } from '../src/middleware/express';
import { MemoryChallengeStore, MemoryUserStore } from '../src/stores/MemoryStore';

describe('Express Routes', () => {
  let app: Express;
  let userStore: MemoryUserStore;
  let challengeStore: MemoryChallengeStore;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    userStore = new MemoryUserStore();
    challengeStore = new MemoryChallengeStore();

    const passkeyAuth = createPasskeyAuth({
      rpName: 'Test App',
      rpID: 'localhost',
      origin: 'http://localhost:3000',
      timeout: 60000,
      userVerification: 'preferred',
    });

    app.use('/api', createExpressRoutes(passkeyAuth));
  });

  afterEach(() => {
    userStore.clear();
    challengeStore.clear();
  });

  describe('POST /api/passkey/register/begin', () => {
    it('should generate registration options', async () => {
      const response = await request(app)
        .post('/api/passkey/register/begin')
        .send({
          userId: 'user123',
          username: 'testuser',
          displayName: 'Test User',
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.challenge).toBeDefined();
      expect(response.body.rp.name).toBe('Test App');
      expect(response.body.user.name).toBe('testuser');
    });

    it('should return 400 if userId is missing', async () => {
      const response = await request(app)
        .post('/api/passkey/register/begin')
        .send({
          username: 'testuser',
          displayName: 'Test User',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if username is missing', async () => {
      const response = await request(app)
        .post('/api/passkey/register/begin')
        .send({
          userId: 'user123',
          displayName: 'Test User',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if displayName is missing', async () => {
      const response = await request(app)
        .post('/api/passkey/register/begin')
        .send({
          userId: 'user123',
          username: 'testuser',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/passkey/register/finish', () => {
    it('should return 400 if userId is missing', async () => {
      const response = await request(app)
        .post('/api/passkey/register/finish')
        .send({
          response: { id: 'test' },
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if response is missing', async () => {
      const response = await request(app)
        .post('/api/passkey/register/finish')
        .send({
          userId: 'user123',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid response', async () => {
      const response = await request(app)
        .post('/api/passkey/register/finish')
        .send({
          userId: 'user123',
          response: { invalid: 'data' },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/passkey/authenticate/begin', () => {
    it('should generate authentication options with userId', async () => {
      // First create a user
      await request(app)
        .post('/api/passkey/register/begin')
        .send({
          userId: 'user123',
          username: 'testuser',
          displayName: 'Test User',
        });

      const response = await request(app)
        .post('/api/passkey/authenticate/begin')
        .send({
          userId: 'user123',
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.challenge).toBeDefined();
    });

    it('should generate authentication options without userId', async () => {
      const response = await request(app)
        .post('/api/passkey/authenticate/begin')
        .send({})
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.challenge).toBeDefined();
    });
  });

  describe('POST /api/passkey/authenticate/finish', () => {
    it('should return 400 if response is missing', async () => {
      const response = await request(app)
        .post('/api/passkey/authenticate/finish')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 for invalid authentication', async () => {
      const response = await request(app)
        .post('/api/passkey/authenticate/finish')
        .send({
          userId: 'user123',
          response: { invalid: 'data' },
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/passkey/user/:userId', () => {
    it('should return user information', async () => {
      // Create a user first
      await request(app)
        .post('/api/passkey/register/begin')
        .send({
          userId: 'user123',
          username: 'testuser',
          displayName: 'Test User',
        });

      const response = await request(app)
        .get('/api/passkey/user/user123')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe('user123');
      expect(response.body.username).toBe('testuser');
      expect(response.body.displayName).toBe('Test User');
      expect(response.body.credentialCount).toBe(0);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/passkey/user/nonexistent')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });
  });
});

describe('Express Middleware', () => {
  it('should attach passkeyAuth to request', (done) => {
    const app = express();
    const passkeyAuth = createPasskeyAuth({
      rpName: 'Test App',
      rpID: 'localhost',
      origin: 'http://localhost:3000',
    });

    app.use(createExpressMiddleware(passkeyAuth));

    app.get('/test', (req: any, res) => {
      expect(req.passkeyAuth).toBeDefined();
      res.json({ success: true });
    });

    request(app)
      .get('/test')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body.success).toBe(true);
        done();
      });
  });
});
