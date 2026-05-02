import express from 'express';
import {
  createTask,
  getTasks,
  updateTaskStatus,
  deleteTask
} from '../controllers/task.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  taskValidation,
  statusValidation,
  taskQueryValidation,
  idParamValidation,
  handleValidationErrors
} from '../middleware/validation.middleware.js';

const router = express.Router();

// POST /api/tasks - Create new task (Admin only)
router.post(
  '/',
  authenticate,
  taskValidation,
  handleValidationErrors,
  createTask
);

// GET /api/tasks - Get tasks with optional filters
router.get(
  '/',
  authenticate,
  taskQueryValidation,
  handleValidationErrors,
  getTasks
);

// PATCH /api/tasks/:id/status - Update task status (Admin or assignee)
router.patch(
  '/:id/status',
  authenticate,
  idParamValidation('id'),
  statusValidation,
  handleValidationErrors,
  updateTaskStatus
);

// DELETE /api/tasks/:id - Delete task (Admin only)
router.delete(
  '/:id',
  authenticate,
  idParamValidation('id'),
  handleValidationErrors,
  deleteTask
);

export default router;
