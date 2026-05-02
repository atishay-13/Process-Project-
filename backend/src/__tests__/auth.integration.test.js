import request from 'supertest';
import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from '../routes/auth.routes.js';
import { authenticate } from '../middleware/auth.middleware.js';

// Load environment variables
dotenv.config();

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';
process.env.ACCESS_TOKEN_EXPIRY = '15m';
process.env.REFRESH_TOKEN_EXPIRY = '7d';

const prisma = new PrismaClient();

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Add a protected route for testing authentication
app.get('/api/protected', authenticate, (req, res) => {
  res.status(200).json({
    message: 'Access granted',
    user: req.user
  });
});

/**
 * Integration tests for authentication flow
 * Tests complete user journeys through the authentication system
 * 
 * Validates Requirements:
 * - 1.1: User signup with valid credentials
 * - 1.2: User login returns tokens
 * - 1.4: Token refresh functionality
 * - 1.5: Logout invalidates refresh token
 */
describe('Authentication Flow Integration Tests', () => {
  // Clean up test data before and after tests
  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'integration-test'
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'integration-test'
        }
      }
    });
    await prisma.$disconnect();
  });

  /**
   * Test: Complete authentication flow
   * Validates: Requirements 1.1, 1.2, 1.4, 1.5
   * 
   * Flow: signup → login → access protected resource
   */
  describe('Signup → Login → Access Protected Resource Flow', () => {
    test('should complete full authentication flow successfully', async () => {
      const testUser = {
        name: 'Integration Test User',
        email: `integration-test-user-${Date.now()}@example.com`,
        password: 'SecurePassword123'
      };

      // Step 1: Signup
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(201);

      expect(signupResponse.body).toEqual({
        message: 'User created successfully',
        user: expect.objectContaining({
          id: expect.any(Number),
          name: testUser.name,
          email: testUser.email,
          created_at: expect.any(String)
        })
      });

      // Verify user was created in database
      const createdUser = await prisma.user.findUnique({
        where: { email: testUser.email }
      });
      expect(createdUser).toBeDefined();
      expect(createdUser.password_hash).toBeDefined();

      // Step 2: Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(loginResponse.body).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          id: createdUser.id,
          name: testUser.name,
          email: testUser.email
        }
      });

      const { accessToken, refreshToken } = loginResponse.body;

      // Step 3: Access protected resource with access token
      const protectedResponse = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(protectedResponse.body).toEqual({
        message: 'Access granted',
        user: {
          id: createdUser.id,
          email: testUser.email
        }
      });

      // Verify tokens are valid JWT format (3 parts separated by dots)
      expect(accessToken.split('.').length).toBe(3);
      expect(refreshToken.split('.').length).toBe(3);
    });

    test('should deny access to protected resource without token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .expect(401);

      expect(response.body).toEqual({
        message: 'Authentication required'
      });
    });

    test('should deny access to protected resource with invalid token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body).toEqual({
        message: 'Invalid token'
      });
    });

    test('should deny access to protected resource with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body).toEqual({
        message: 'Authentication required'
      });
    });
  });

  /**
   * Test: Token refresh flow
   * Validates: Requirement 1.4
   * 
   * Flow: login → refresh token → access protected resource with new token
   */
  describe('Token Refresh Flow', () => {
    test('should refresh access token and access protected resource', async () => {
      const testUser = {
        name: 'Refresh Test User',
        email: `integration-test-refresh-${Date.now()}@example.com`,
        password: 'SecurePassword123'
      };

      // Step 1: Create user
      await request(app)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(201);

      // Step 2: Login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const { refreshToken } = loginResponse.body;

      // Step 3: Use refresh token to get new access token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body).toEqual({
        accessToken: expect.any(String)
      });

      const newAccessToken = refreshResponse.body.accessToken;

      // Verify new access token is valid JWT format
      expect(newAccessToken.split('.').length).toBe(3);

      // Step 4: Access protected resource with new access token
      const protectedResponse = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      expect(protectedResponse.body).toEqual({
        message: 'Access granted',
        user: expect.objectContaining({
          email: testUser.email
        })
      });
    });

    test('should reject refresh request with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.refresh.token' })
        .expect(401);

      expect(response.body).toEqual({
        message: 'Invalid or expired refresh token'
      });
    });

    test('should reject refresh request without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(401);

      expect(response.body).toEqual({
        message: 'Refresh token is required'
      });
    });

    test('should reject refresh request with invalidated (logged out) token', async () => {
      const testUser = {
        name: 'Invalidated Token Test User',
        email: `integration-test-invalidated-${Date.now()}@example.com`,
        password: 'SecurePassword123'
      };

      // Create user and login
      await request(app)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const { refreshToken } = loginResponse.body;

      // Logout to invalidate the refresh token
      await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      // Try to refresh with invalidated token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(refreshResponse.body).toEqual({
        message: 'Invalid or expired refresh token'
      });
    });
  });

  /**
   * Test: Logout flow
   * Validates: Requirement 1.5
   * 
   * Flow: login → logout → verify token is invalidated
   */
  describe('Logout Flow', () => {
    test('should logout successfully and invalidate refresh token', async () => {
      const testUser = {
        name: 'Logout Test User',
        email: `integration-test-logout-${Date.now()}@example.com`,
        password: 'SecurePassword123'
      };

      // Step 1: Create user
      await request(app)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(201);

      // Step 2: Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const { refreshToken } = loginResponse.body;

      // Step 3: Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(logoutResponse.body).toEqual({
        message: 'Logged out successfully'
      });

      // Step 4: Verify refresh token is invalidated
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(refreshResponse.body).toEqual({
        message: 'Invalid or expired refresh token'
      });
    });

    test('should return error when logging out without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        message: 'Refresh token is required'
      });
    });

    test('should allow logout even with invalid refresh token', async () => {
      // Logout should succeed even with invalid token (idempotent operation)
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Logged out successfully'
      });
    });
  });

  /**
   * Test: Complete user journey
   * Validates: Requirements 1.1, 1.2, 1.4, 1.5
   * 
   * Flow: signup → login → access resource → refresh → access resource → logout → verify invalidation
   */
  describe('Complete User Journey', () => {
    test('should complete full user lifecycle successfully', async () => {
      const testUser = {
        name: 'Journey Test User',
        email: `integration-test-journey-${Date.now()}@example.com`,
        password: 'SecurePassword123'
      };

      // 1. Signup
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(201);

      expect(signupResponse.body.message).toBe('User created successfully');
      const userId = signupResponse.body.user.id;

      // 2. Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const { accessToken: firstAccessToken, refreshToken } = loginResponse.body;

      // 3. Access protected resource with first access token
      await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${firstAccessToken}`)
        .expect(200);

      // 4. Refresh to get new access token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const { accessToken: secondAccessToken } = refreshResponse.body;

      // 5. Access protected resource with new access token
      const protectedResponse = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .expect(200);

      expect(protectedResponse.body.user.id).toBe(userId);

      // 6. Logout
      await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      // 7. Verify refresh token is invalidated
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      // 8. Verify old access tokens still work (they're stateless JWTs)
      // Note: In production, you might want to implement token blacklisting
      await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .expect(200);
    });
  });

  /**
   * Test: Multiple users authentication isolation
   * Validates: Requirements 1.1, 1.2
   * 
   * Ensures tokens are user-specific and cannot be used across users
   */
  describe('Multi-User Authentication Isolation', () => {
    test('should maintain authentication isolation between users', async () => {
      const timestamp = Date.now();
      const user1 = {
        name: 'User One',
        email: `integration-test-user1-${timestamp}@example.com`,
        password: 'Password123'
      };

      const user2 = {
        name: 'User Two',
        email: `integration-test-user2-${timestamp}@example.com`,
        password: 'Password456'
      };

      // Create both users
      const signup1 = await request(app)
        .post('/api/auth/signup')
        .send(user1)
        .expect(201);

      const signup2 = await request(app)
        .post('/api/auth/signup')
        .send(user2)
        .expect(201);

      const user1Id = signup1.body.user.id;
      const user2Id = signup2.body.user.id;

      // Login both users
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({ email: user1.email, password: user1.password })
        .expect(200);

      const login2 = await request(app)
        .post('/api/auth/login')
        .send({ email: user2.email, password: user2.password })
        .expect(200);

      // Verify each user's token returns their own data
      const protected1 = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${login1.body.accessToken}`)
        .expect(200);

      const protected2 = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${login2.body.accessToken}`)
        .expect(200);

      expect(protected1.body.user.id).toBe(user1Id);
      expect(protected1.body.user.email).toBe(user1.email);

      expect(protected2.body.user.id).toBe(user2Id);
      expect(protected2.body.user.email).toBe(user2.email);

      // Verify user1's refresh token doesn't work for user2's data
      const refresh1 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login1.body.refreshToken })
        .expect(200);

      const protectedAfterRefresh = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${refresh1.body.accessToken}`)
        .expect(200);

      expect(protectedAfterRefresh.body.user.id).toBe(user1Id);
      expect(protectedAfterRefresh.body.user.id).not.toBe(user2Id);
    });
  });
});
