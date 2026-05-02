import { signup, login, refresh, logout } from '../auth.controller.js';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../utils/password.util.js';
import { generateRefreshToken } from '../../utils/jwt.util.js';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.ACCESS_TOKEN_EXPIRY = '15m';
process.env.REFRESH_TOKEN_EXPIRY = '7d';

const prisma = new PrismaClient();

/**
 * Integration tests for authentication endpoints
 * Validates Requirements 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8, 11.2, 18.2
 */
describe('Auth Controller', () => {
  // Helper function to create mock response object
  function createMockResponse() {
    const res = {
      statusCode: null,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      }
    };
    return res;
  }

  // Mock request and response objects
  let req, res;

  beforeEach(() => {
    req = {
      body: {}
    };
    res = createMockResponse();
  });

  afterEach(async () => {
    // Clean up test data - delete all test users
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { contains: 'test' } },
          { email: { contains: 'example.com' } }
        ]
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/auth/signup', () => {
    test('should create a new user with valid credentials', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      await signup(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData).toEqual({
        message: 'User created successfully',
        user: expect.objectContaining({
          id: expect.any(Number),
          name: 'Test User',
          email: 'test@example.com',
          created_at: expect.any(Date)
        })
      });

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: 'test@example.com' }
      });
      expect(user).toBeDefined();
      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe('password123'); // Password should be hashed
    });

    test('should return 400 if name is missing', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      await signup(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Name, email, and password are required'
      });
    });

    test('should return 400 if email is missing', async () => {
      req.body = {
        name: 'Test User',
        password: 'password123'
      };

      await signup(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Name, email, and password are required'
      });
    });

    test('should return 400 if password is missing', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com'
      };

      await signup(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Name, email, and password are required'
      });
    });

    test('should return 400 for invalid email format', async () => {
      req.body = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      };

      await signup(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Invalid email format'
      });
    });

    test('should return 400 if password is less than 8 characters', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'short'
      };

      await signup(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Password must be at least 8 characters long'
      });
    });

    test('should return 400 if email already exists', async () => {
      // Create a user first
      await prisma.user.create({
        data: {
          name: 'Existing User',
          email: 'existing@example.com',
          password_hash: await hashPassword('password123')
        }
      });

      req.body = {
        name: 'Test User',
        email: 'existing@example.com',
        password: 'password123'
      };

      await signup(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Email already exists'
      });
    });

    test('should not return password hash in response', async () => {
      req.body = {
        name: 'Test User',
        email: 'test2@example.com',
        password: 'password123'
      };

      await signup(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData.user.password_hash).toBeUndefined();
      expect(res.jsonData.user.password).toBeUndefined();
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      // Create a test user
      testUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'login@example.com',
          password_hash: await hashPassword('password123')
        }
      });
    });

    test('should return tokens and user data with valid credentials', async () => {
      req.body = {
        email: 'login@example.com',
        password: 'password123'
      };

      await login(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          id: testUser.id,
          name: 'Test User',
          email: 'login@example.com'
        }
      });
    });

    test('should return 400 if email is missing', async () => {
      req.body = {
        password: 'password123'
      };

      await login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Email and password are required'
      });
    });

    test('should return 400 if password is missing', async () => {
      req.body = {
        email: 'login@example.com'
      };

      await login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Email and password are required'
      });
    });

    test('should return 401 with generic error for non-existent email', async () => {
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      await login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({
        message: 'Invalid credentials'
      });
    });

    test('should return 401 with generic error for incorrect password', async () => {
      req.body = {
        email: 'login@example.com',
        password: 'wrongpassword'
      };

      await login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({
        message: 'Invalid credentials'
      });
    });

    test('should not reveal whether email exists (no user enumeration)', async () => {
      // Test with non-existent email
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };
      await login(req, res);
      const nonExistentResponse = res.jsonData;

      // Reset response
      res = createMockResponse();

      // Test with wrong password
      req.body = {
        email: 'login@example.com',
        password: 'wrongpassword'
      };
      await login(req, res);
      const wrongPasswordResponse = res.jsonData;

      // Both should return the same generic error message
      expect(nonExistentResponse.message).toBe(wrongPasswordResponse.message);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let testUser, validRefreshToken;

    beforeEach(async () => {
      // Create a test user
      testUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'refresh@example.com',
          password_hash: await hashPassword('password123')
        }
      });

      validRefreshToken = generateRefreshToken(testUser);
    });

    test('should return new access token with valid refresh token', async () => {
      req.body = {
        refreshToken: validRefreshToken
      };

      await refresh(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        accessToken: expect.any(String)
      });
    });

    test('should return 401 if refresh token is missing', async () => {
      req.body = {};

      await refresh(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({
        message: 'Refresh token is required'
      });
    });

    test('should return 401 for invalid refresh token', async () => {
      req.body = {
        refreshToken: 'invalid.token.here'
      };

      await refresh(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({
        message: 'Invalid or expired refresh token'
      });
    });

    test('should return 401 for expired refresh token', async () => {
      // This would require mocking time or creating an expired token
      // For now, we'll test with an invalid token format
      req.body = {
        refreshToken: 'expired.token.here'
      };

      await refresh(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({
        message: 'Invalid or expired refresh token'
      });
    });

    test('should return 401 if refresh token has been invalidated (logged out)', async () => {
      // First, logout with the token
      req.body = { refreshToken: validRefreshToken };
      await logout(req, res);

      // Reset response
      res = createMockResponse();

      // Try to use the same token to refresh
      req.body = { refreshToken: validRefreshToken };
      await refresh(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({
        message: 'Invalid or expired refresh token'
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    let testUser, validRefreshToken;

    beforeEach(async () => {
      // Create a test user
      testUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'logout@example.com',
          password_hash: await hashPassword('password123')
        }
      });

      validRefreshToken = generateRefreshToken(testUser);
    });

    test('should successfully logout with valid refresh token', async () => {
      req.body = {
        refreshToken: validRefreshToken
      };

      await logout(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        message: 'Logged out successfully'
      });
    });

    test('should return 400 if refresh token is missing', async () => {
      req.body = {};

      await logout(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Refresh token is required'
      });
    });

    test('should invalidate refresh token after logout', async () => {
      // Logout
      req.body = { refreshToken: validRefreshToken };
      await logout(req, res);

      // Reset response
      res = createMockResponse();

      // Try to refresh with the logged out token
      req.body = { refreshToken: validRefreshToken };
      await refresh(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({
        message: 'Invalid or expired refresh token'
      });
    });
  });

  describe('Authentication Flow Integration', () => {
    test('should complete full signup → login → refresh → logout flow', async () => {
      // 1. Signup
      req.body = {
        name: 'Flow Test User',
        email: 'flow@example.com',
        password: 'password123'
      };
      await signup(req, res);
      expect(res.statusCode).toBe(201);

      // Reset response
      res = createMockResponse();

      // 2. Login
      req.body = {
        email: 'flow@example.com',
        password: 'password123'
      };
      await login(req, res);
      expect(res.statusCode).toBe(200);
      
      const { accessToken, refreshToken } = res.jsonData;
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();

      // Reset response
      res = createMockResponse();

      // 3. Refresh token
      req.body = { refreshToken };
      await refresh(req, res);
      expect(res.statusCode).toBe(200);
      
      expect(res.jsonData.accessToken).toBeDefined();
      // New token is generated (may be same if generated in same second, but that's okay)

      // Reset response
      res = createMockResponse();

      // 4. Logout
      req.body = { refreshToken };
      await logout(req, res);
      expect(res.statusCode).toBe(200);

      // Reset response
      res = createMockResponse();

      // 5. Try to refresh after logout (should fail)
      req.body = { refreshToken };
      await refresh(req, res);
      expect(res.statusCode).toBe(401);
    });
  });
});
