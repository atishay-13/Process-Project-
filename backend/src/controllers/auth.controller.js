import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from '../utils/password.util.js';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt.util.js';

const prisma = new PrismaClient();

// Store for invalidated refresh tokens (in production, use Redis or database)
const invalidatedTokens = new Set();

/**
 * Signup endpoint - Create a new user account
 * POST /api/auth/signup
 */
export async function signup(req, res) {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Invalid email format'
      });
    }

    // Validate password length (minimum 8 characters)
    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'Email already exists'
      });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash
      },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true
      }
    });

    return res.status(201).json({
      message: 'User created successfully',
      user
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Login endpoint - Authenticate user and return tokens
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // Generic error message to prevent user enumeration
    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Return tokens and user data (excluding password hash)
    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Refresh endpoint - Generate new access token from refresh token
 * POST /api/auth/refresh
 */
export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;

    // Validate required field
    if (!refreshToken) {
      return res.status(401).json({
        message: 'Refresh token is required'
      });
    }

    // Check if token has been invalidated (logged out)
    if (invalidatedTokens.has(refreshToken)) {
      return res.status(401).json({
        message: 'Invalid or expired refresh token'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        message: 'Invalid or expired refresh token'
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid or expired refresh token'
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user);

    return res.status(200).json({
      accessToken
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Logout endpoint - Invalidate refresh token
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;

    // Validate required field
    if (!refreshToken) {
      return res.status(400).json({
        message: 'Refresh token is required'
      });
    }

    // Add token to invalidated set
    invalidatedTokens.add(refreshToken);

    return res.status(200).json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}
