import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFoundHandler, AppError } from '../middleware/error.middleware.js';

// Create a test app with error handling middleware
function createTestApp() {
  const app = express();
  
  // Security middleware
  app.use(helmet());
  app.use(cors());
  
  // Body parsing
  app.use(express.json());
  
  // Test routes
  app.get('/test/success', (req, res) => {
    res.json({ message: 'Success' });
  });
  
  app.get('/test/validation-error', (req, res, next) => {
    next(new AppError('Validation failed', 400));
  });
  
  app.get('/test/auth-error', (req, res, next) => {
    next(new AppError('Authentication required', 401));
  });
  
  app.get('/test/forbidden-error', (req, res, next) => {
    next(new AppError('Insufficient permissions', 403));
  });
  
  app.get('/test/not-found-error', (req, res, next) => {
    next(new AppError('Resource not found', 404));
  });
  
  app.get('/test/server-error', (req, res, next) => {
    next(new Error('Internal server error'));
  });
  
  app.get('/test/prisma-unique-error', (req, res, next) => {
    const error = new Error('Unique constraint failed');
    error.code = 'P2002';
    error.meta = { target: ['email'] };
    next(error);
  });
  
  app.get('/test/prisma-not-found', (req, res, next) => {
    const error = new Error('Record not found');
    error.code = 'P2025';
    next(error);
  });
  
  app.get('/test/jwt-error', (req, res, next) => {
    const error = new Error('Invalid token');
    error.name = 'JsonWebTokenError';
    next(error);
  });
  
  // 404 handler
  app.use(notFoundHandler);
  
  // Error handler
  app.use(errorHandler);
  
  return app;
}

describe('Error Handling Integration Tests', () => {
  let app;
  let originalConsoleError;

  beforeAll(() => {
    app = createTestApp();
    // Suppress console.error during tests
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  describe('Successful requests', () => {
    it('should return 200 for successful requests', async () => {
      const response = await request(app)
        .get('/test/success')
        .expect(200);
      
      expect(response.body.message).toBe('Success');
    });
  });

  describe('Client errors (4xx)', () => {
    it('should return 400 for validation errors', async () => {
      const response = await request(app)
        .get('/test/validation-error')
        .expect(400);
      
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return 401 for authentication errors', async () => {
      const response = await request(app)
        .get('/test/auth-error')
        .expect(401);
      
      expect(response.body.message).toBe('Authentication required');
    });

    it('should return 403 for authorization errors', async () => {
      const response = await request(app)
        .get('/test/forbidden-error')
        .expect(403);
      
      expect(response.body.message).toBe('Insufficient permissions');
    });

    it('should return 404 for not found errors', async () => {
      const response = await request(app)
        .get('/test/not-found-error')
        .expect(404);
      
      expect(response.body.message).toBe('Resource not found');
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);
      
      expect(response.body.message).toContain('Route not found');
    });
  });

  describe('Server errors (5xx)', () => {
    it('should return 500 for server errors', async () => {
      const response = await request(app)
        .get('/test/server-error')
        .expect(500);
      
      expect(response.body.message).toBeDefined();
    });
  });

  describe('Prisma errors', () => {
    it('should return 400 for unique constraint violations', async () => {
      const response = await request(app)
        .get('/test/prisma-unique-error')
        .expect(400);
      
      expect(response.body.message).toContain('email already exists');
    });

    it('should return 404 for Prisma record not found', async () => {
      const response = await request(app)
        .get('/test/prisma-not-found')
        .expect(404);
      
      expect(response.body.message).toBe('Resource not found');
    });
  });

  describe('JWT errors', () => {
    it('should return 401 for JWT errors', async () => {
      const response = await request(app)
        .get('/test/jwt-error')
        .expect(401);
      
      expect(response.body.message).toBe('Invalid token');
    });
  });

  describe('Security headers', () => {
    it('should include security headers from helmet', async () => {
      const response = await request(app)
        .get('/test/success')
        .expect(200);
      
      // Helmet adds various security headers
      expect(response.headers['x-content-type-options']).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/test/success')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');
      
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Error response format', () => {
    it('should return consistent JSON error format', async () => {
      const response = await request(app)
        .get('/test/validation-error')
        .expect(400);
      
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
    });

    it('should not expose stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/test/server-error')
        .expect(500);
      
      expect(response.body.stack).toBeUndefined();
      expect(response.body.message).toBe('An internal server error occurred');
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});
