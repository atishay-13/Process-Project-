import express from 'express';
import { signup, login, refresh, logout } from '../controllers/auth.controller.js';
import { signupValidation, loginValidation, handleValidationErrors } from '../middleware/validation.middleware.js';

const router = express.Router();

// POST /api/auth/signup - Create new user account
router.post('/signup', signupValidation, handleValidationErrors, signup);

// POST /api/auth/login - Authenticate user and return tokens
router.post('/login', loginValidation, handleValidationErrors, login);

// POST /api/auth/refresh - Generate new access token from refresh token
router.post('/refresh', refresh);

// POST /api/auth/logout - Invalidate refresh token
router.post('/logout', logout);

export default router;
