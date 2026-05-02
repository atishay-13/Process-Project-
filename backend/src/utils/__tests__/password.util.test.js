import { hashPassword, verifyPassword } from '../password.util.js';
import bcrypt from 'bcrypt';

/**
 * Unit tests for password utilities
 * Validates Requirements 1.3: Password hashing using bcrypt before storing in database
 */
describe('Password Utilities', () => {
  describe('hashPassword', () => {
    test('should hash a password successfully', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should use bcrypt with 10 salt rounds', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      // bcrypt hashes start with $2b$ followed by cost factor (salt rounds)
      // Format: $2b$10$... where 10 is the salt rounds
      expect(hash).toMatch(/^\$2b\$10\$/);
    });

    test('should generate different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    test('should hash empty string', async () => {
      const password = '';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should produce bcrypt-compatible hash format', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      // Verify the hash can be used with bcrypt.compare
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    test('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    test('should reject empty password against valid hash', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('', hash);
      
      expect(isValid).toBe(false);
    });

    test('should handle case-sensitive passwords', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('testpassword123', hash);
      
      expect(isValid).toBe(false);
    });
  });
});
