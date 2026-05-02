import { jest } from '@jest/globals';
import fc from 'fast-check';

// Mock Prisma Client
const mockPrismaClient = {
  projectMember: {
    findFirst: jest.fn()
  },
  task: {
    findUnique: jest.fn()
  }
};

// Mock the Prisma module BEFORE importing the middleware
jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient)
}));

// Import middleware AFTER mocking
const { requireAdmin, requireProjectMember } = await import('../rbac.middleware.js');

/**
 * Property-Based Tests for Authorization Rules
 * 
 * These tests validate the correctness properties defined in the design document:
 * - Property 3: Admin Project Creation Authorization
 * - Property 4: Member Project Creation Denial
 * - Property 7: Admin Member Management Authorization
 * - Property 8: Member Management Denial
 * 
 * Validates Requirements: 2.2, 2.3, 2.6, 2.7, 3.1
 */

describe('RBAC Property-Based Tests', () => {
  let res, next;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  /**
   * Property 3: Admin Project Creation Authorization
   * 
   * For any authenticated user with Admin role and any valid project name,
   * the API server SHALL allow project creation and store the project with the creator's user ID.
   * 
   * Validates: Requirements 2.2, 3.1
   */
  describe('Property 3: Admin Project Creation Authorization', () => {
    it('should allow any authenticated Admin user to create projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // user_id
          fc.integer({ min: 1, max: 10000 }), // project_id
          fc.string({ minLength: 1, maxLength: 100 }), // project name
          async (userId, projectId, projectName) => {
            // Setup: User is Admin of the project
            const req = {
              user: { id: userId, email: `user${userId}@example.com` },
              params: { projectId: projectId.toString() },
              body: { name: projectName }
            };

            mockPrismaClient.projectMember.findFirst.mockResolvedValue({
              id: 1,
              user_id: userId,
              project_id: projectId,
              role: 'Admin'
            });

            // Execute
            await requireAdmin(req, res, next);

            // Verify: Admin should be allowed to proceed
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalledWith(403);
            expect(req.membership).toBeDefined();
            expect(req.membership.role).toBe('Admin');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should verify Admin role is checked for any project ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // user_id
          fc.integer({ min: 1, max: 10000 }), // project_id
          async (userId, projectId) => {
            const req = {
              user: { id: userId, email: `user${userId}@example.com` },
              params: { projectId: projectId.toString() },
              body: {}
            };

            mockPrismaClient.projectMember.findFirst.mockResolvedValue({
              id: 1,
              user_id: userId,
              project_id: projectId,
              role: 'Admin'
            });

            await requireAdmin(req, res, next);

            // Verify the correct query was made
            expect(mockPrismaClient.projectMember.findFirst).toHaveBeenCalledWith({
              where: {
                user_id: userId,
                project_id: projectId,
                role: 'Admin'
              }
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 4: Member Project Creation Denial
   * 
   * For any authenticated user with Member role,
   * the API server SHALL deny project creation requests with a 403 Forbidden status.
   * 
   * Validates: Requirements 2.3
   */
  describe('Property 4: Member Project Creation Denial', () => {
    it('should deny any authenticated Member user from creating projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // user_id
          fc.integer({ min: 1, max: 10000 }), // project_id
          fc.string({ minLength: 1, maxLength: 100 }), // project name
          async (userId, projectId, projectName) => {
            // Setup: User is Member (not Admin) of the project
            const req = {
              user: { id: userId, email: `user${userId}@example.com` },
              params: { projectId: projectId.toString() },
              body: { name: projectName }
            };

            // Mock returns null because user is not Admin
            mockPrismaClient.projectMember.findFirst.mockResolvedValue(null);

            // Execute
            await requireAdmin(req, res, next);

            // Verify: Member should be denied with 403
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
              message: 'Insufficient permissions to perform this action'
            });
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should consistently deny non-Admin users regardless of project', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // user_id
          fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 10 }), // multiple project_ids
          async (userId, projectIds) => {
            for (const projectId of projectIds) {
              const req = {
                user: { id: userId, email: `user${userId}@example.com` },
                params: { projectId: projectId.toString() },
                body: {}
              };

              mockPrismaClient.projectMember.findFirst.mockResolvedValue(null);

              await requireAdmin(req, res, next);

              // Every attempt should be denied
              expect(res.status).toHaveBeenCalledWith(403);
              
              // Reset mocks for next iteration
              jest.clearAllMocks();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 7: Admin Member Management Authorization
   * 
   * For any project and any authenticated Admin user who is a member of that project,
   * the API server SHALL allow adding and removing other members.
   * 
   * Validates: Requirements 2.6
   */
  describe('Property 7: Admin Member Management Authorization', () => {
    it('should allow any Admin to manage members in their projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // admin_user_id
          fc.integer({ min: 1, max: 10000 }), // project_id
          fc.integer({ min: 1, max: 10000 }), // target_user_id (user being added/removed)
          fc.constantFrom('Admin', 'Member'), // role to assign
          async (adminUserId, projectId, targetUserId, role) => {
            // Setup: Admin user managing members
            const req = {
              user: { id: adminUserId, email: `admin${adminUserId}@example.com` },
              params: { projectId: projectId.toString() },
              body: { user_id: targetUserId, role }
            };

            mockPrismaClient.projectMember.findFirst.mockResolvedValue({
              id: 1,
              user_id: adminUserId,
              project_id: projectId,
              role: 'Admin'
            });

            // Execute
            await requireAdmin(req, res, next);

            // Verify: Admin should be allowed to proceed with member management
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalledWith(403);
            expect(req.membership).toBeDefined();
            expect(req.membership.role).toBe('Admin');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should verify Admin can manage members across different projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // admin_user_id
          fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 5 }), // multiple project_ids
          async (adminUserId, projectIds) => {
            for (const projectId of projectIds) {
              const req = {
                user: { id: adminUserId, email: `admin${adminUserId}@example.com` },
                params: { projectId: projectId.toString() },
                body: {}
              };

              mockPrismaClient.projectMember.findFirst.mockResolvedValue({
                id: 1,
                user_id: adminUserId,
                project_id: projectId,
                role: 'Admin'
              });

              await requireAdmin(req, res, next);

              // Admin should be allowed in each project they're Admin of
              expect(next).toHaveBeenCalled();
              
              // Reset mocks for next iteration
              jest.clearAllMocks();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 8: Member Management Denial
   * 
   * For any project and any authenticated Member user,
   * the API server SHALL deny member addition and removal requests with a 403 Forbidden status.
   * 
   * Validates: Requirements 2.7
   */
  describe('Property 8: Member Management Denial', () => {
    it('should deny any Member user from managing project members', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // member_user_id
          fc.integer({ min: 1, max: 10000 }), // project_id
          fc.integer({ min: 1, max: 10000 }), // target_user_id
          fc.constantFrom('Admin', 'Member'), // role they're trying to assign
          async (memberUserId, projectId, targetUserId, role) => {
            // Setup: Member user trying to manage members
            const req = {
              user: { id: memberUserId, email: `member${memberUserId}@example.com` },
              params: { projectId: projectId.toString() },
              body: { user_id: targetUserId, role }
            };

            // Mock returns null because user is not Admin
            mockPrismaClient.projectMember.findFirst.mockResolvedValue(null);

            // Execute
            await requireAdmin(req, res, next);

            // Verify: Member should be denied with 403
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
              message: 'Insufficient permissions to perform this action'
            });
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should consistently deny Members across all projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // member_user_id
          fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 10 }), // multiple project_ids
          async (memberUserId, projectIds) => {
            for (const projectId of projectIds) {
              const req = {
                user: { id: memberUserId, email: `member${memberUserId}@example.com` },
                params: { projectId: projectId.toString() },
                body: {}
              };

              // Member is not Admin in any project
              mockPrismaClient.projectMember.findFirst.mockResolvedValue(null);

              await requireAdmin(req, res, next);

              // Every attempt should be denied
              expect(res.status).toHaveBeenCalledWith(403);
              
              // Reset mocks for next iteration
              jest.clearAllMocks();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should deny Members even if they are project members', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // member_user_id
          fc.integer({ min: 1, max: 10000 }), // project_id
          async (memberUserId, projectId) => {
            const req = {
              user: { id: memberUserId, email: `member${memberUserId}@example.com` },
              params: { projectId: projectId.toString() },
              body: {}
            };

            // User is a Member but not Admin - requireAdmin should return null
            mockPrismaClient.projectMember.findFirst.mockResolvedValue(null);

            await requireAdmin(req, res, next);

            // Should be denied because they're not Admin
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional Property: Role Separation
   * 
   * Verifies that Admin and Member roles are mutually exclusive in authorization checks
   */
  describe('Property: Role Separation', () => {
    it('should enforce that only Admin role grants admin permissions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // user_id
          fc.integer({ min: 1, max: 10000 }), // project_id
          fc.constantFrom('Admin', 'Member'), // role
          async (userId, projectId, role) => {
            // Reset mocks before each test
            jest.clearAllMocks();
            
            const req = {
              user: { id: userId, email: `user${userId}@example.com` },
              params: { projectId: projectId.toString() },
              body: {}
            };

            if (role === 'Admin') {
              mockPrismaClient.projectMember.findFirst.mockResolvedValue({
                id: 1,
                user_id: userId,
                project_id: projectId,
                role: 'Admin'
              });

              await requireAdmin(req, res, next);

              // Admin should be allowed
              expect(next).toHaveBeenCalled();
              expect(res.status).not.toHaveBeenCalledWith(403);
            } else {
              // Member role - requireAdmin should return null
              mockPrismaClient.projectMember.findFirst.mockResolvedValue(null);

              await requireAdmin(req, res, next);

              // Member should be denied
              expect(res.status).toHaveBeenCalledWith(403);
              expect(next).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional Property: Project Membership Verification
   * 
   * Verifies that users can only perform actions on projects they are members of
   */
  describe('Property: Project Membership Verification', () => {
    it('should verify project membership for any user and project combination', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // user_id
          fc.integer({ min: 1, max: 10000 }), // project_id they're member of
          fc.integer({ min: 1, max: 10000 }), // different project_id they're NOT member of
          async (userId, memberProjectId, nonMemberProjectId) => {
            // Ensure the two project IDs are different
            fc.pre(memberProjectId !== nonMemberProjectId);

            // Test 1: User is member of memberProjectId
            const req1 = {
              user: { id: userId, email: `user${userId}@example.com` },
              params: { projectId: memberProjectId.toString() },
              body: {}
            };

            mockPrismaClient.projectMember.findFirst.mockResolvedValue({
              id: 1,
              user_id: userId,
              project_id: memberProjectId,
              role: 'Member'
            });

            await requireProjectMember(req1, res, next);

            // Should be allowed
            expect(next).toHaveBeenCalled();
            
            jest.clearAllMocks();

            // Test 2: User is NOT member of nonMemberProjectId
            const req2 = {
              user: { id: userId, email: `user${userId}@example.com` },
              params: { projectId: nonMemberProjectId.toString() },
              body: {}
            };

            mockPrismaClient.projectMember.findFirst.mockResolvedValue(null);

            await requireProjectMember(req2, res, next);

            // Should be denied
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
