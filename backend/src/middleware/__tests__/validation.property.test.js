import { jest } from '@jest/globals';
import * as fc from 'fast-check';
import {
  projectValidation,
  taskValidation,
  statusValidation,
  addMemberValidation,
  idParamValidation,
  handleValidationErrors
} from '../validation.middleware.js';

// Helper function to run validation
async function runValidation(validations, req, res, next) {
  for (const validation of validations) {
    await validation.run(req);
  }
  handleValidationErrors(req, res, next);
}

// Helper to create mock request/response objects
function createMockReqRes() {
  const req = {
    body: {},
    params: {},
    query: {}
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Input Validation Property Tests', () => {
  describe('Feature: team-task-manager, Property 13: Empty Project Name Rejection', () => {
    it('should reject any empty or whitespace-only project name with 400 status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for empty/whitespace strings
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t'),
            fc.constant('\n'),
            fc.constant('  \t  \n  ')
          ),
          async (projectName) => {
            const { req, res, next } = createMockReqRes();
            req.body = { name: projectName };

            await runValidation(projectValidation, req, res, next);

            // Verify 400 status was returned
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining('Project name is required')
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: team-task-manager, Property 22: Empty Task Title Rejection', () => {
    it('should reject any empty or whitespace-only task title with 400 status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for empty/whitespace strings
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t'),
            fc.constant('\n'),
            fc.constant('  \t  \n  ')
          ),
          async (taskTitle) => {
            const { req, res, next } = createMockReqRes();
            req.body = {
              title: taskTitle,
              due_date: '2024-12-31',
              project_id: 1
            };

            await runValidation(taskValidation, req, res, next);

            // Verify 400 status was returned
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining('Task title is required')
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: team-task-manager, Property 25: Date Format Validation', () => {
    it('should reject any invalid date format with 400 status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for invalid date strings
          fc.oneof(
            fc.constant('invalid-date'),
            fc.constant('2024/12/31'),
            fc.constant('31-12-2024'),
            fc.constant('12/31/2024'),
            fc.constant('2024-13-01'), // Invalid month
            fc.constant('2024-12-32'), // Invalid day
            fc.constant('not a date'),
            fc.constant('2024-1-1'), // Missing leading zeros
            fc.constant('24-12-31'), // Two-digit year
            fc.constant(''),
            fc.string().filter(s => !s.match(/^\d{4}-\d{2}-\d{2}$/))
          ),
          async (invalidDate) => {
            const { req, res, next } = createMockReqRes();
            req.body = {
              title: 'Valid Task',
              due_date: invalidDate,
              project_id: 1
            };

            await runValidation(taskValidation, req, res, next);

            // Verify 400 status was returned
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringMatching(/Invalid date format|Due date is required/)
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid ISO 8601 date formats', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for valid ISO 8601 dates
          fc.integer({ min: 2020, max: 2030 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid dates
          async (year, month, day) => {
            const validDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const { req, res, next } = createMockReqRes();
            req.body = {
              title: 'Valid Task',
              due_date: validDate,
              project_id: 1
            };

            await runValidation(taskValidation, req, res, next);

            // Verify validation passed
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: team-task-manager, Property 27: Invalid Status Rejection', () => {
    it('should reject any status not in allowed values with 400 status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for invalid status strings
          fc.string().filter(s => !['To Do', 'In Progress', 'Done'].includes(s)),
          async (invalidStatus) => {
            const { req, res, next } = createMockReqRes();
            req.body = { status: invalidStatus };

            await runValidation(statusValidation, req, res, next);

            // Verify 400 status was returned
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringMatching(/Status must be one of|Status is required/)
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept only valid status values', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for valid status values
          fc.constantFrom('To Do', 'In Progress', 'Done'),
          async (validStatus) => {
            const { req, res, next } = createMockReqRes();
            req.body = { status: validStatus };

            await runValidation(statusValidation, req, res, next);

            // Verify validation passed
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: team-task-manager, Property 38: Required Field Validation', () => {
    it('should reject requests missing required fields with 400 status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for incomplete task data (missing required fields)
          fc.record({
            title: fc.option(fc.string(), { nil: undefined }),
            due_date: fc.option(fc.string(), { nil: undefined }),
            project_id: fc.option(fc.integer(), { nil: undefined })
          }).filter(data => 
            // Ensure at least one required field is missing
            !data.title || !data.due_date || !data.project_id
          ),
          async (incompleteData) => {
            const { req, res, next } = createMockReqRes();
            req.body = incompleteData;

            await runValidation(taskValidation, req, res, next);

            // Verify 400 status was returned
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.any(String)
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject requests with empty strings for required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('', '   ', '\t', '\n'),
          async (emptyString) => {
            const { req, res, next } = createMockReqRes();
            req.body = {
              title: emptyString,
              due_date: '2024-12-31',
              project_id: 1
            };

            await runValidation(taskValidation, req, res, next);

            // Verify 400 status was returned
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining('Task title is required')
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: team-task-manager, Property 39: Numeric ID Validation', () => {
    it('should reject non-positive integer IDs with 400 status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for invalid IDs (zero, negative, non-integer)
          fc.oneof(
            fc.constant(0),
            fc.integer({ max: -1 }),
            fc.double({ min: 0.1, max: 100, noNaN: true }).filter(n => n % 1 !== 0)
          ),
          async (invalidId) => {
            const { req, res, next } = createMockReqRes();
            req.body = {
              title: 'Valid Task',
              due_date: '2024-12-31',
              project_id: invalidId
            };

            await runValidation(taskValidation, req, res, next);

            // Verify 400 status was returned
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining('Project ID must be a positive integer')
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-numeric ID parameters with 400 status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for non-numeric strings
          fc.oneof(
            fc.constant('abc'),
            fc.constant('not-a-number'),
            fc.constant('1.5'),
            fc.constant('-1'),
            fc.constant('0'),
            fc.string().filter(s => isNaN(parseInt(s)) || parseInt(s) <= 0)
          ),
          async (invalidId) => {
            const { req, res, next } = createMockReqRes();
            req.params = { id: invalidId };

            await runValidation(idParamValidation('id'), req, res, next);

            // Verify 400 status was returned
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining('id must be a positive integer')
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept positive integer IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for valid positive integers
          fc.integer({ min: 1, max: 1000000 }),
          async (validId) => {
            const { req, res, next } = createMockReqRes();
            req.body = {
              title: 'Valid Task',
              due_date: '2024-12-31',
              project_id: validId
            };

            await runValidation(taskValidation, req, res, next);

            // Verify validation passed
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid user_id in addMember validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(0),
            fc.integer({ max: -1 })
          ),
          async (invalidUserId) => {
            const { req, res, next } = createMockReqRes();
            req.body = {
              user_id: invalidUserId,
              role: 'Admin'
            };

            await runValidation(addMemberValidation, req, res, next);

            // Verify 400 status was returned
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining('User ID must be a positive integer')
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid assigned_to in task validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(0),
            fc.integer({ max: -1 })
          ),
          async (invalidAssigneeId) => {
            const { req, res, next } = createMockReqRes();
            req.body = {
              title: 'Valid Task',
              due_date: '2024-12-31',
              assigned_to: invalidAssigneeId,
              project_id: 1
            };

            await runValidation(taskValidation, req, res, next);

            // Verify 400 status was returned
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining('Assignee ID must be a positive integer')
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: team-task-manager, Property 40: Validation Error Response Format', () => {
    it('should return 400 status with JSON message field for any validation failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generator for various invalid inputs
          fc.record({
            invalidField: fc.constantFrom(
              { name: '' }, // Empty project name
              { title: '' }, // Empty task title
              { status: 'Invalid' }, // Invalid status
              { user_id: 0 }, // Invalid user ID
              { project_id: -1 } // Invalid project ID
            )
          }),
          async ({ invalidField }) => {
            const { req, res, next } = createMockReqRes();
            
            // Determine which validation to use based on the field
            let validation;
            if ('name' in invalidField) {
              req.body = invalidField;
              validation = projectValidation;
            } else if ('title' in invalidField) {
              req.body = { ...invalidField, due_date: '2024-12-31', project_id: 1 };
              validation = taskValidation;
            } else if ('status' in invalidField) {
              req.body = invalidField;
              validation = statusValidation;
            } else if ('user_id' in invalidField) {
              req.body = { ...invalidField, role: 'Admin' };
              validation = addMemberValidation;
            } else if ('project_id' in invalidField) {
              req.body = { title: 'Task', due_date: '2024-12-31', ...invalidField };
              validation = taskValidation;
            }

            await runValidation(validation, req, res, next);

            // Verify response format
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.any(String)
              })
            );
            
            // Verify message field is a non-empty string
            const responseData = res.json.mock.calls[0][0];
            expect(typeof responseData.message).toBe('string');
            expect(responseData.message.length).toBeGreaterThan(0);
            
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include descriptive error messages in validation failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { validation: projectValidation, body: { name: '' }, expectedMessage: 'Project name is required' },
            { validation: taskValidation, body: { title: '', due_date: '2024-12-31', project_id: 1 }, expectedMessage: 'Task title is required' },
            { validation: statusValidation, body: { status: 'Invalid' }, expectedMessage: 'Status must be one of' },
            { validation: addMemberValidation, body: { user_id: 0, role: 'Admin' }, expectedMessage: 'User ID must be a positive integer' }
          ),
          async ({ validation, body, expectedMessage }) => {
            const { req, res, next } = createMockReqRes();
            req.body = body;

            await runValidation(validation, req, res, next);

            // Verify descriptive error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining(expectedMessage)
              })
            );
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
