import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler, notFoundHandler } from '../middleware/error.middleware.js';

// Create a test app similar to server.js
function createTestApp() {
  const app = express();
  
  // Security middleware
  app.use(helmet());
  app.use(cors());
  
  // Body parsing
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });
  
  // 404 handler
  app.use(notFoundHandler);
  
  // Error handler
  app.use(errorHandler);
  
  return app;
}

describe('Health Check Endpoint', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /health', () => {
    it('should return 200 status', async () => {
      await request(app)
        .get('/health')
        .expect(200);
    });

    it('should return status "ok"', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('ok');
    });

    it('should return a timestamp', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.timestamp).toBeDefined();
      expect(typeof response.body.timestamp).toBe('string');
      
      // Verify it's a valid ISO 8601 timestamp
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });

    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should not require authentication', async () => {
      // Health check should work without any auth headers
      await request(app)
        .get('/health')
        .expect(200);
    });

    it('should return current timestamp (within 5 seconds)', async () => {
      const beforeRequest = new Date();
      
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      const afterRequest = new Date();
      const responseTimestamp = new Date(response.body.timestamp);
      
      // Timestamp should be between before and after request
      expect(responseTimestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime() - 1000);
      expect(responseTimestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime() + 1000);
    });
  });
});
