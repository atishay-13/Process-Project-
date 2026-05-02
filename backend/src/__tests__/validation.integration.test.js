import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { signupValidation, loginValidation, handleValidationErrors } from '../middleware/validation.middleware.js';

// Create test app with mock controllers
const app = express();
app.use(express.json());

// Mock signup endpoint
app.post('/api/auth/signup', 
  signupValidation, 
  handleValidationErrors, 
  (req, res) => res.status(201).json({ message: 'User created successfully' })
);

// Mock login endpoint
app.post('/api/auth/login', 
  loginValidation, 
  handleValidationErrors, 
  (req, res) => res.status(200).json({ message: 'Login successful' })
);

describe('Validation Integration Tests', () => {
  describe('POST /api/auth/signup', () => {
    it('should accept valid signup data', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User created successfully');
    });

    it('should reject signup with missing name', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'john@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Name is required');
    });

    it('should reject signup with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid email format');
    });

    it('should reject signup with short password', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'short'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should reject signup with empty name after trimming', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: '   ',
          email: 'john@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Name is required');
    });

    it('should reject signup with multiple validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: '',
          email: 'invalid',
          password: 'short'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Name is required');
      expect(response.body.message).toContain('Invalid email format');
      expect(response.body.message).toContain('Password must be at least 8 characters');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should accept valid login data', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
    });

    it('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email is required');
    });

    it('should reject login with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid email format');
    });

    it('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Password is required');
    });

    it('should reject login with both email and password missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email is required');
      expect(response.body.message).toContain('Password is required');
    });
  });
});
