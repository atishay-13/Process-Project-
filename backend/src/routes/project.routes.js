import express from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  deleteProject,
  addProjectMember,
  removeProjectMember
} from '../controllers/project.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin, requireProjectMember } from '../middleware/rbac.middleware.js';
import {
  projectValidation,
  idParamValidation,
  addMemberValidation,
  handleValidationErrors
} from '../middleware/validation.middleware.js';

const router = express.Router();

// POST /api/projects - Create new project (Admin only)
// Note: requireAdmin checks if user has Admin role in ANY project they're a member of
// For project creation, we just need authentication since they're creating a NEW project
router.post(
  '/',
  authenticate,
  projectValidation,
  handleValidationErrors,
  createProject
);

// GET /api/projects - Get all projects where user is a member
router.get(
  '/',
  authenticate,
  getProjects
);

// GET /api/projects/:id - Get project details by ID
router.get(
  '/:id',
  authenticate,
  idParamValidation('id'),
  handleValidationErrors,
  requireProjectMember,
  getProjectById
);

// DELETE /api/projects/:id - Delete project (Admin only, must be creator)
router.delete(
  '/:id',
  authenticate,
  idParamValidation('id'),
  handleValidationErrors,
  requireAdmin,
  deleteProject
);

// POST /api/projects/:id/members - Add member to project (Admin only)
router.post(
  '/:id/members',
  authenticate,
  idParamValidation('id'),
  addMemberValidation,
  handleValidationErrors,
  requireAdmin,
  addProjectMember
);

// DELETE /api/projects/:id/members/:userId - Remove member from project (Admin only)
router.delete(
  '/:id/members/:userId',
  authenticate,
  idParamValidation('id'),
  idParamValidation('userId'),
  handleValidationErrors,
  requireAdmin,
  removeProjectMember
);

export default router;
