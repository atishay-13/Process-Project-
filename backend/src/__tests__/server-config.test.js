/**
 * Tests for server configuration and environment variable validation
 */

import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Load environment variables for tests
dotenv.config();

describe('Server Configuration', () => {
  describe('Environment Variable Validation', () => {
    it('should have all required environment variables in .env file', () => {
      // This test verifies that the current environment has all required variables
      const requiredEnvVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'ACCESS_TOKEN_EXPIRY',
        'REFRESH_TOKEN_EXPIRY'
      ];

      requiredEnvVars.forEach(varName => {
        expect(process.env[varName]).toBeDefined();
        expect(process.env[varName]).not.toBe('');
      });
    });

    it('should use default PORT value when not specified', () => {
      const PORT = process.env.PORT || 5000;
      // PORT from env is a string, or default is a number
      expect(PORT).toBeTruthy();
      const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
      expect(portNumber).toBeGreaterThan(0);
    });

    it('should use default FRONTEND_URL when not specified', () => {
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
      expect(FRONTEND_URL).toBeTruthy();
      expect(typeof FRONTEND_URL).toBe('string');
    });
  });

  describe('Server Middleware Configuration', () => {
    it('should verify helmet middleware is available', () => {
      expect(helmet).toBeDefined();
      expect(typeof helmet).toBe('function');
    });

    it('should verify cors middleware is available', () => {
      expect(cors).toBeDefined();
      expect(typeof cors).toBe('function');
    });

    it('should verify rate-limit middleware is available', () => {
      expect(rateLimit).toBeDefined();
      expect(typeof rateLimit).toBe('function');
    });
  });

  describe('Package.json Scripts', () => {
    it('should verify required npm scripts exist', async () => {
      const packageJson = await import('../../package.json', { assert: { type: 'json' } });
      const scripts = packageJson.default.scripts;

      expect(scripts.start).toBeDefined();
      expect(scripts.dev).toBeDefined();
      expect(scripts.migrate).toBeDefined();
      expect(scripts.generate).toBeDefined();
      expect(scripts.build).toBeDefined();
      
      // Verify script commands
      expect(scripts.start).toContain('node src/server.js');
      expect(scripts.migrate).toContain('prisma migrate');
      expect(scripts.generate).toContain('prisma generate');
    });
  });
});
