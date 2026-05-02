# Middleware Documentation

This directory contains all Express middleware used in the Team Task Manager backend.

## Available Middleware

### Authentication Middleware (`auth.middleware.js`)
- **authenticate**: Verifies JWT tokens and attaches user information to requests
- Used on all protected routes

### Authorization Middleware (`rbac.middleware.js`)
- **requireAdmin**: Ensures user has Admin role for a project
- **requireProjectMember**: Ensures user is a member of a project
- **requireTaskOwnerOrAdmin**: Ensures user is task owner or project admin
- Used for role-based access control

### Validation Middleware (`validation.middleware.js`)
- **signupValidation**: Validates signup request data
- **loginValidation**: Validates login request data
- **projectValidation**: Validates project creation data
- **taskValidation**: Validates task creation data
- **statusValidation**: Validates task status updates
- **handleValidationErrors**: Processes validation errors and returns 400 responses
- Used on all endpoints that accept user input

### Error Handling Middleware (`error.middleware.js`)
- **errorHandler**: Global error handler that maps errors to HTTP status codes
- **notFoundHandler**: Handles 404 errors for non-existent routes
- **asyncHandler**: Wrapper for async route handlers to catch errors
- **AppError**: Custom error class for application errors

## Error Handling

The error handling middleware provides:

1. **Consistent Error Responses**: All errors return JSON with a `message` field
2. **Status Code Mapping**:
   - 400: Validation errors, bad requests
   - 401: Authentication errors
   - 403: Authorization errors
   - 404: Resource not found
   - 500: Server errors

3. **Prisma Error Handling**:
   - P2002: Unique constraint violation → 400
   - P2025: Record not found → 404
   - P2003: Foreign key constraint violation → 400

4. **Security**:
   - Hides sensitive error details in production
   - Logs all errors server-side
   - Never exposes stack traces in production

## Security Middleware

The application uses the following security middleware (configured in `server.js`):

1. **helmet**: Sets security headers
2. **cors**: Restricts cross-origin requests to frontend domain
3. **express-rate-limit**: Rate limits authentication endpoints (100 requests per 15 minutes)

## Usage Example

```javascript
import express from 'express';
import { authenticate } from './middleware/auth.middleware.js';
import { requireAdmin } from './middleware/rbac.middleware.js';
import { projectValidation, handleValidationErrors } from './middleware/validation.middleware.js';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/error.middleware.js';

const app = express();

// Apply middleware to routes
app.post('/api/projects',
  authenticate,
  requireAdmin,
  projectValidation,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    // Route handler
  })
);

// 404 handler (after all routes)
app.use(notFoundHandler);

// Error handler (last middleware)
app.use(errorHandler);
```

## Testing

All middleware has comprehensive test coverage:
- Unit tests for individual middleware functions
- Integration tests for middleware chains
- Property-based tests for validation and authorization rules

Run tests with:
```bash
npm test
```
