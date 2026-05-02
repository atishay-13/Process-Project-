# Authentication Utilities

This directory contains utility functions for authentication and authorization in the Team Task Manager backend.

## Files

### password.util.js
Password hashing and verification utilities using bcrypt.

**Functions:**
- `hashPassword(password)` - Hash a plain text password with bcrypt (10 salt rounds)
- `verifyPassword(password, hash)` - Verify a password against a hash

**Example:**
```javascript
import { hashPassword, verifyPassword } from './utils/password.util.js';

// During signup
const hashedPassword = await hashPassword('userPassword123');
// Store hashedPassword in database

// During login
const isValid = await verifyPassword('userPassword123', hashedPassword);
if (isValid) {
  // Password is correct
}
```

### jwt.util.js
JWT token generation and verification utilities.

**Functions:**
- `generateAccessToken(user)` - Generate a short-lived access token
- `generateRefreshToken(user)` - Generate a long-lived refresh token
- `verifyToken(token)` - Verify and decode a JWT token

**Example:**
```javascript
import { generateAccessToken, generateRefreshToken, verifyToken } from './utils/jwt.util.js';

// After successful login
const user = { id: 1, email: 'user@example.com' };
const accessToken = generateAccessToken(user);
const refreshToken = generateRefreshToken(user);

// Send tokens to client
res.json({ accessToken, refreshToken, user });

// Verify token (done by middleware)
try {
  const decoded = verifyToken(accessToken);
  console.log(decoded.userId, decoded.email);
} catch (error) {
  // Token is invalid or expired
}
```

## Middleware

### auth.middleware.js
Express middleware for JWT authentication.

**Functions:**
- `authenticate(req, res, next)` - Verify JWT token and attach user to request

**Example:**
```javascript
import { authenticate } from './middleware/auth.middleware.js';

// Protect routes with authentication
router.get('/api/projects', authenticate, projectController.getProjects);

// In the controller, access authenticated user
function getProjects(req, res) {
  const userId = req.user.id; // Set by authenticate middleware
  // ... fetch projects for user
}
```

## Environment Variables

Required environment variables:
- `JWT_SECRET` - Secret key for signing JWT tokens
- `ACCESS_TOKEN_EXPIRY` - Expiration time for access tokens (e.g., "15m")
- `REFRESH_TOKEN_EXPIRY` - Expiration time for refresh tokens (e.g., "7d")

## Security Notes

1. **Password Hashing**: Uses bcrypt with 10 salt rounds as specified in requirements
2. **JWT Tokens**: 
   - Access tokens are short-lived (15 minutes by default)
   - Refresh tokens are long-lived (7 days by default)
   - Each refresh token has a unique ID to enable revocation
3. **Token Verification**: Handles expired tokens and invalid tokens with appropriate error messages
4. **Authentication Middleware**: Returns 401 status for authentication failures

## Testing

Unit tests are located in `__tests__` directories:
- `utils/__tests__/password.util.test.js`
- `utils/__tests__/jwt.util.test.js`
- `middleware/__tests__/auth.middleware.test.js`

Run tests with:
```bash
npm test
```
