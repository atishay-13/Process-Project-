import { body, param, query, validationResult } from 'express-validator';

/**
 * Validation rules for user signup
 * Validates name, email format, and password length (min 8 characters)
 * Requirements: 1.7, 1.8, 11.2, 11.3
 */
export const signupValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
];

/**
 * Validation rules for user login
 * Validates email and password are provided
 * Requirements: 11.3
 */
export const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Validation rules for project creation
 * Validates project name is not empty
 * Requirements: 3.5, 11.3
 */
export const projectValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Project name is required')
];

/**
 * Validation rules for task creation
 * Validates title, due date format, and optional assignee/project IDs
 * Requirements: 5.2, 5.6, 11.3, 11.4, 11.5
 */
export const taskValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required'),
  body('description')
    .optional()
    .trim(),
  body('due_date')
    .notEmpty()
    .withMessage('Due date is required')
    .isISO8601()
    .withMessage('Invalid date format. Use ISO 8601 format (YYYY-MM-DD)'),
  body('assigned_to')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Assignee ID must be a positive integer'),
  body('project_id')
    .notEmpty()
    .withMessage('Project ID is required')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer')
];

/**
 * Validation rules for task status update
 * Validates status is one of the allowed values
 * Requirements: 6.2, 11.6
 */
export const statusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['To Do', 'In Progress', 'Done'])
    .withMessage('Status must be one of: To Do, In Progress, Done')
];

/**
 * Validation rules for adding project member
 * Validates user_id and role
 * Requirements: 11.3, 11.4, 11.6
 */
export const addMemberValidation = [
  body('user_id')
    .notEmpty()
    .withMessage('User ID is required')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['Admin', 'Member'])
    .withMessage('Role must be either Admin or Member')
];

/**
 * Validation rules for numeric ID parameters
 * Validates that ID parameters are positive integers
 * Requirements: 11.4
 */
export const idParamValidation = (paramName = 'id') => [
  param(paramName)
    .isInt({ min: 1 })
    .withMessage(`${paramName} must be a positive integer`)
];

/**
 * Validation rules for task query filters
 * Validates optional query parameters for task filtering
 * Requirements: 11.4, 11.6
 */
export const taskQueryValidation = [
  query('project_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
  query('status')
    .optional()
    .isIn(['To Do', 'In Progress', 'Done'])
    .withMessage('Status must be one of: To Do, In Progress, Done'),
  query('assigned_to_me')
    .optional()
    .isBoolean()
    .withMessage('assigned_to_me must be a boolean value')
];

/**
 * Middleware to handle validation errors
 * Returns 400 Bad Request with descriptive error messages if validation fails
 * Requirements: 11.7
 */
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Extract error messages
    const errorMessages = errors.array().map(err => err.msg);
    
    return res.status(400).json({ 
      message: errorMessages.join('. ')
    });
  }
  
  next();
}
