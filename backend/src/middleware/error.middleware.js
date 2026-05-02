/**
 * Global error handling middleware
 * Maps error types to appropriate HTTP status codes and returns consistent JSON responses
 * Hides sensitive error details in production
 */

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 * Should be registered as the last middleware in the Express app
 */
export const errorHandler = (err, req, res, next) => {
  // Log error details server-side
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Determine status code
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An internal server error occurred';

  // Handle Prisma errors
  if (err.code) {
    const prismaError = handlePrismaError(err);
    statusCode = prismaError.statusCode;
    message = prismaError.message;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Prepare response
  const response = {
    message: message
  };

  // In development, include stack trace and additional details
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.error = err;
  }

  // In production, hide sensitive error details for 500 errors
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    response.message = 'An internal server error occurred';
  }

  res.status(statusCode).json(response);
};

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(err) {
  // P2002: Unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    return {
      statusCode: 400,
      message: `A record with this ${field} already exists`
    };
  }

  // P2025: Record not found
  if (err.code === 'P2025') {
    return {
      statusCode: 404,
      message: 'Resource not found'
    };
  }

  // P2003: Foreign key constraint violation
  if (err.code === 'P2003') {
    const field = err.meta?.field_name || 'reference';
    return {
      statusCode: 400,
      message: `Invalid ${field}: referenced record does not exist`
    };
  }

  // P2014: Invalid ID (relation violation)
  if (err.code === 'P2014') {
    return {
      statusCode: 400,
      message: 'Invalid relationship: the referenced record does not exist'
    };
  }

  // P2021: Table does not exist
  if (err.code === 'P2021') {
    return {
      statusCode: 500,
      message: 'Database configuration error'
    };
  }

  // P2024: Connection timeout
  if (err.code === 'P2024') {
    return {
      statusCode: 500,
      message: 'Database connection timeout'
    };
  }

  // Default Prisma error
  return {
    statusCode: 500,
    message: 'Database operation failed'
  };
}

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to the error handler
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 * Should be registered before the error handler middleware
 */
export const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
};
