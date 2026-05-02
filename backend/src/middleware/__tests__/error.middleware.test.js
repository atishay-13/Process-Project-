import { AppError, errorHandler, asyncHandler, notFoundHandler } from '../error.middleware.js';

describe('Error Middleware', () => {
  let req, res, next;
  let originalConsoleError;

  beforeEach(() => {
    req = {
      url: '/test',
      method: 'GET',
      originalUrl: '/test'
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
    next = function(err) {
      next.called = true;
      next.error = err;
    };
    next.called = false;
    next.error = null;
    
    // Suppress console.error during tests
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('AppError', () => {
    it('should create an error with message and status code', () => {
      const error = new AppError('Test error', 400);
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('errorHandler', () => {
    it('should return 400 for validation errors', () => {
      const error = new AppError('Validation failed', 400);
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(400);
      expect(res.jsonData.message).toBe('Validation failed');
    });

    it('should return 401 for authentication errors', () => {
      const error = new AppError('Authentication required', 401);
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.message).toBe('Authentication required');
    });

    it('should return 403 for authorization errors', () => {
      const error = new AppError('Insufficient permissions', 403);
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(403);
      expect(res.jsonData.message).toBe('Insufficient permissions');
    });

    it('should return 404 for not found errors', () => {
      const error = new AppError('Resource not found', 404);
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(404);
      expect(res.jsonData.message).toBe('Resource not found');
    });

    it('should return 500 for server errors', () => {
      const error = new Error('Unexpected error');
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(500);
      expect(res.jsonData.message).toBe('Unexpected error');
    });

    it('should handle JWT errors with 401 status', () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.message).toBe('Invalid token');
    });

    it('should handle token expiration errors with 401 status', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.message).toBe('Token expired');
    });

    it('should handle Prisma unique constraint violation (P2002)', () => {
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      error.meta = { target: ['email'] };
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(400);
      expect(res.jsonData.message).toBe('A record with this email already exists');
    });

    it('should handle Prisma record not found (P2025)', () => {
      const error = new Error('Record not found');
      error.code = 'P2025';
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(404);
      expect(res.jsonData.message).toBe('Resource not found');
    });

    it('should handle Prisma foreign key constraint violation (P2003)', () => {
      const error = new Error('Foreign key constraint failed');
      error.code = 'P2003';
      error.meta = { field_name: 'project_id' };
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(400);
      expect(res.jsonData.message).toBe('Invalid project_id: referenced record does not exist');
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      
      errorHandler(error, req, res, next);
      
      expect(res.jsonData.stack).toBeDefined();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should hide sensitive details in production for 500 errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Database connection failed');
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(500);
      expect(res.jsonData.message).toBe('An internal server error occurred');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not hide error message in production for 4xx errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new AppError('Invalid input', 400);
      
      errorHandler(error, req, res, next);
      
      expect(res.statusCode).toBe(400);
      expect(res.jsonData.message).toBe('Invalid input');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should log error details', () => {
      let loggedError = null;
      console.error = (msg, details) => {
        loggedError = details;
      };
      
      const error = new Error('Test error');
      
      errorHandler(error, req, res, next);
      
      expect(loggedError).toBeDefined();
      expect(loggedError.message).toBe('Test error');
      expect(loggedError.url).toBe('/test');
      expect(loggedError.method).toBe('GET');
    });
  });

  describe('asyncHandler', () => {
    it('should catch async errors and pass to next', async () => {
      const error = new Error('Async error');
      const asyncFn = async () => {
        throw error;
      };
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(req, res, next);
      
      expect(next.called).toBe(true);
      expect(next.error).toBe(error);
    });

    it('should call the function with req, res, next', async () => {
      let called = false;
      let calledWith = null;
      const asyncFn = async (r1, r2, n) => {
        called = true;
        calledWith = { r1, r2, n };
      };
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(req, res, next);
      
      expect(called).toBe(true);
      expect(calledWith.r1).toBe(req);
      expect(calledWith.r2).toBe(res);
      expect(calledWith.n).toBe(next);
    });

    it('should not call next if function succeeds', async () => {
      const asyncFn = async () => {
        // Success - do nothing
      };
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(req, res, next);
      
      expect(next.called).toBe(false);
    });
  });

  describe('notFoundHandler', () => {
    it('should create 404 error with route information', () => {
      req.originalUrl = '/api/nonexistent';
      
      notFoundHandler(req, res, next);
      
      expect(next.called).toBe(true);
      expect(next.error).toBeDefined();
      expect(next.error.message).toBe('Route not found: /api/nonexistent');
      expect(next.error.statusCode).toBe(404);
    });
  });
});
