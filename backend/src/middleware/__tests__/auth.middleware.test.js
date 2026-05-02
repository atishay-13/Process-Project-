import { authenticate } from '../auth.middleware.js';
import { generateAccessToken } from '../../utils/jwt.util.js';
import jwt from 'jsonwebtoken';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.ACCESS_TOKEN_EXPIRY = '15m';

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    
    // Create mock response object
    const jsonMock = function(data) {
      this.jsonData = data;
      return this;
    };
    const statusMock = function(code) {
      this.statusCode = code;
      return this;
    };
    
    res = {
      status: statusMock,
      json: jsonMock,
      statusCode: null,
      jsonData: null
    };
    
    // Create mock next function
    next = function() {
      next.called = true;
    };
    next.called = false;
  });

  describe('authenticate', () => {
    test('should authenticate with valid token', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      const token = generateAccessToken(mockUser);
      req.headers.authorization = `Bearer ${token}`;

      await authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(mockUser.id);
      expect(req.user.email).toBe(mockUser.email);
      expect(next.called).toBe(true);
      expect(res.statusCode).toBeNull();
    });

    test('should reject request without authorization header', async () => {
      await authenticate(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({ message: 'Authentication required' });
      expect(next.called).toBe(false);
    });

    test('should reject request with malformed authorization header', async () => {
      req.headers.authorization = 'InvalidFormat token';

      await authenticate(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({ message: 'Authentication required' });
      expect(next.called).toBe(false);
    });

    test('should reject request with invalid token', async () => {
      req.headers.authorization = 'Bearer invalid.token.here';

      await authenticate(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({ message: 'Invalid token' });
      expect(next.called).toBe(false);
    });

    test('should reject expired token', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      // Create an expired token (expired 1 hour ago)
      const expiredToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );
      req.headers.authorization = `Bearer ${expiredToken}`;

      await authenticate(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({ message: 'Token expired' });
      expect(next.called).toBe(false);
    });

    test('should reject empty bearer token', async () => {
      req.headers.authorization = 'Bearer ';

      await authenticate(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next.called).toBe(false);
    });

    test('should handle token with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        'wrong-secret',
        { expiresIn: '15m' }
      );
      req.headers.authorization = `Bearer ${wrongSecretToken}`;

      await authenticate(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({ message: 'Invalid token' });
      expect(next.called).toBe(false);
    });
  });
});
