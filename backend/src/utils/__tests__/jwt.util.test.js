import { generateAccessToken, generateRefreshToken, verifyToken } from '../jwt.util.js';
import jwt from 'jsonwebtoken';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.ACCESS_TOKEN_EXPIRY = '15m';
process.env.REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Unit tests for JWT utilities
 * Validates Requirements 1.4: Access token expiration and refresh token acceptance
 */
describe('JWT Utilities', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com'
  };

  describe('generateAccessToken', () => {
    test('should generate a valid access token', () => {
      const token = generateAccessToken(mockUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    test('should include user id and email in token payload', () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
    });

    test('should include expiration time', () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyToken(token);
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    test('should set expiration time according to ACCESS_TOKEN_EXPIRY', () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyToken(token);
      
      // 15 minutes = 900 seconds
      const expectedExpiry = decoded.iat + 900;
      expect(decoded.exp).toBe(expectedExpiry);
    });
  });

  describe('generateRefreshToken', () => {
    test('should generate a valid refresh token', () => {
      const token = generateRefreshToken(mockUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    test('should include user id and unique token id', () => {
      const token = generateRefreshToken(mockUser);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.tokenId).toBeDefined();
      expect(typeof decoded.tokenId).toBe('string');
    });

    test('should generate unique token ids for each refresh token', () => {
      const token1 = generateRefreshToken(mockUser);
      const token2 = generateRefreshToken(mockUser);
      
      const decoded1 = verifyToken(token1);
      const decoded2 = verifyToken(token2);
      
      expect(decoded1.tokenId).not.toBe(decoded2.tokenId);
    });

    test('should set expiration time according to REFRESH_TOKEN_EXPIRY', () => {
      const token = generateRefreshToken(mockUser);
      const decoded = verifyToken(token);
      
      // 7 days = 604800 seconds
      const expectedExpiry = decoded.iat + 604800;
      expect(decoded.exp).toBe(expectedExpiry);
    });
  });

  describe('verifyToken', () => {
    test('should verify and decode a valid token', () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
    });

    test('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      
      expect(() => verifyToken(invalidToken)).toThrow();
    });

    test('should throw error for malformed token', () => {
      const malformedToken = 'not-a-jwt-token';
      
      expect(() => verifyToken(malformedToken)).toThrow();
    });

    test('should throw error for empty token', () => {
      expect(() => verifyToken('')).toThrow();
    });

    test('should throw error for expired token', () => {
      // Create a token that expired 1 hour ago
      const expiredToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );
      
      expect(() => verifyToken(expiredToken)).toThrow();
    });

    test('should throw TokenExpiredError for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );
      
      try {
        verifyToken(expiredToken);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('TokenExpiredError');
      }
    });

    test('should throw JsonWebTokenError for invalid signature', () => {
      const tokenWithWrongSecret = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        'wrong-secret',
        { expiresIn: '15m' }
      );
      
      try {
        verifyToken(tokenWithWrongSecret);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).toBe('JsonWebTokenError');
      }
    });
  });
});
