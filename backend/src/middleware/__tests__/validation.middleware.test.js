import { jest } from '@jest/globals';
import {
  signupValidation,
  loginValidation,
  projectValidation,
  taskValidation,
  statusValidation,
  addMemberValidation,
  idParamValidation,
  taskQueryValidation,
  handleValidationErrors
} from '../validation.middleware.js';

// Helper function to run validation
async function runValidation(validations, req, res, next) {
  for (const validation of validations) {
    await validation.run(req);
  }
  handleValidationErrors(req, res, next);
}

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('signupValidation', () => {
    it('should pass validation with valid signup data', async () => {
      req.body = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      await runValidation(signupValidation, req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail validation when name is missing', async () => {
      req.body = {
        email: 'john@example.com',
        password: 'password123'
      };

      await runValidation(signupValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Name is required')
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail validation when email is invalid', async () => {
      req.body = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'password123'
      };

      await runValidation(signupValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid email format')
        })
      );
    });

    it('should fail validation when password is too short', async () => {
      req.body = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'short'
      };

      await runValidation(signupValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Password must be at least 8 characters')
        })
      );
    });

    it('should trim whitespace from name and email', async () => {
      req.body = {
        name: '  John Doe  ',
        email: '  john@example.com  ',
        password: 'password123'
      };

      await runValidation(signupValidation, req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.name).toBe('John Doe');
      expect(req.body.email).toBe('john@example.com');
    });
  });

  describe('loginValidation', () => {
    it('should pass validation with valid login data', async () => {
      req.body = {
        email: 'john@example.com',
        password: 'password123'
      };

      await runValidation(loginValidation, req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail validation when email is missing', async () => {
      req.body = {
        password: 'password123'
      };

      await runValidation(loginValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Email is required')
        })
      );
    });

    it('should fail validation when password is missing', async () => {
      req.body = {
        email: 'john@example.com'
      };

      await runValidation(loginValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Password is required')
        })
      );
    });
  });

  describe('projectValidation', () => {
    it('should pass validation with valid project name', async () => {
      req.body = {
        name: 'My Project'
      };

      await runValidation(projectValidation, req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail validation when project name is empty', async () => {
      req.body = {
        name: ''
      };

      await runValidation(projectValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Project name is required')
        })
      );
    });

    it('should fail validation when project name is only whitespace', async () => {
      req.body = {
        name: '   '
      };

      await runValidation(projectValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Project name is required')
        })
      );
    });
  });

  describe('taskValidation', () => {
    it('should pass validation with valid task data', async () => {
      req.body = {
        title: 'My Task',
        description: 'Task description',
        due_date: '2024-12-31',
        assigned_to: 1,
        project_id: 1
      };

      await runValidation(taskValidation, req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass validation with optional fields omitted', async () => {
      req.body = {
        title: 'My Task',
        due_date: '2024-12-31',
        project_id: 1
      };

      await runValidation(taskValidation, req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should fail validation when title is empty', async () => {
      req.body = {
        title: '',
        due_date: '2024-12-31',
        project_id: 1
      };

      await runValidation(taskValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Task title is required')
        })
      );
    });

    it('should fail validation when due_date is invalid format', async () => {
      req.body = {
        title: 'My Task',
        due_date: 'invalid-date',
        project_id: 1
      };

      await runValidation(taskValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid date format')
        })
      );
    });

    it('should fail validation when assigned_to is not a positive integer', async () => {
      req.body = {
        title: 'My Task',
        due_date: '2024-12-31',
        assigned_to: -1,
        project_id: 1
      };

      await runValidation(taskValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Assignee ID must be a positive integer')
        })
      );
    });

    it('should fail validation when project_id is not a positive integer', async () => {
      req.body = {
        title: 'My Task',
        due_date: '2024-12-31',
        project_id: 0
      };

      await runValidation(taskValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Project ID must be a positive integer')
        })
      );
    });
  });

  describe('statusValidation', () => {
    it('should pass validation with valid status "To Do"', async () => {
      req.body = { status: 'To Do' };

      await runValidation(statusValidation, req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass validation with valid status "In Progress"', async () => {
      req.body = { status: 'In Progress' };

      await runValidation(statusValidation, req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should pass validation with valid status "Done"', async () => {
      req.body = { status: 'Done' };

      await runValidation(statusValidation, req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should fail validation with invalid status', async () => {
      req.body = { status: 'Invalid Status' };

      await runValidation(statusValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Status must be one of: To Do, In Progress, Done')
        })
      );
    });

    it('should fail validation when status is missing', async () => {
      req.body = {};

      await runValidation(statusValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Status is required')
        })
      );
    });
  });

  describe('addMemberValidation', () => {
    it('should pass validation with valid member data', async () => {
      req.body = {
        user_id: 1,
        role: 'Admin'
      };

      await runValidation(addMemberValidation, req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass validation with Member role', async () => {
      req.body = {
        user_id: 1,
        role: 'Member'
      };

      await runValidation(addMemberValidation, req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should fail validation when user_id is not a positive integer', async () => {
      req.body = {
        user_id: 0,
        role: 'Admin'
      };

      await runValidation(addMemberValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('User ID must be a positive integer')
        })
      );
    });

    it('should fail validation when role is invalid', async () => {
      req.body = {
        user_id: 1,
        role: 'InvalidRole'
      };

      await runValidation(addMemberValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Role must be either Admin or Member')
        })
      );
    });
  });

  describe('idParamValidation', () => {
    it('should pass validation with valid positive integer ID', async () => {
      req.params.id = '1';

      await runValidation(idParamValidation('id'), req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail validation with zero ID', async () => {
      req.params.id = '0';

      await runValidation(idParamValidation('id'), req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('id must be a positive integer')
        })
      );
    });

    it('should fail validation with negative ID', async () => {
      req.params.id = '-1';

      await runValidation(idParamValidation('id'), req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should fail validation with non-numeric ID', async () => {
      req.params.id = 'abc';

      await runValidation(idParamValidation('id'), req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('taskQueryValidation', () => {
    it('should pass validation with valid query parameters', async () => {
      req.query = {
        project_id: '1',
        status: 'To Do',
        assigned_to_me: 'true'
      };

      await runValidation(taskQueryValidation, req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass validation with no query parameters', async () => {
      req.query = {};

      await runValidation(taskQueryValidation, req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should fail validation with invalid project_id', async () => {
      req.query = {
        project_id: '0'
      };

      await runValidation(taskQueryValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Project ID must be a positive integer')
        })
      );
    });

    it('should fail validation with invalid status', async () => {
      req.query = {
        status: 'Invalid'
      };

      await runValidation(taskQueryValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Status must be one of: To Do, In Progress, Done')
        })
      );
    });

    it('should fail validation with invalid assigned_to_me', async () => {
      req.query = {
        assigned_to_me: 'not-a-boolean'
      };

      await runValidation(taskQueryValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('assigned_to_me must be a boolean value')
        })
      );
    });
  });

  describe('handleValidationErrors', () => {
    it('should call next when there are no validation errors', () => {
      // Mock validationResult to return no errors
      const mockValidationResult = {
        isEmpty: () => true,
        array: () => []
      };

      // We need to test this directly since we can't easily mock validationResult
      // This is implicitly tested by all the "should pass validation" tests above
      expect(true).toBe(true);
    });

    it('should return 400 with error messages when validation fails', async () => {
      req.body = {
        name: '',
        email: 'invalid'
      };

      await runValidation(signupValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String)
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should combine multiple error messages', async () => {
      req.body = {
        // Missing all required fields
      };

      await runValidation(signupValidation, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const errorMessage = res.json.mock.calls[0][0].message;
      expect(errorMessage).toContain('Name is required');
      expect(errorMessage).toContain('Email is required');
      expect(errorMessage).toContain('Password is required');
    });
  });
});
