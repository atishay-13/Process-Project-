import { verifyToken } from '../utils/jwt.util.js';

/**
 * Authentication middleware to verify JWT tokens
 * Verifies the JWT token from the Authorization header and attaches user info to req.user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    // Check if Authorization header exists and has Bearer format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Extract token from "Bearer <token>"
    const token = authHeader.substring(7);
    
    // Verify token and decode payload
    const decoded = verifyToken(token);
    
    // Attach user info to request object for use in subsequent middleware/routes
    req.user = {
      id: decoded.userId,
      email: decoded.email
    };
    
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Handle other errors
    return res.status(401).json({ message: 'Authentication failed' });
  }
}
