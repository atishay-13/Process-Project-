import { jest } from '@jest/globals';

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
const { requireAdmin, requireProjectMember, requireTaskOwnerOrAdmin } = await import('../rbac.middleware.js');

describe('RBAC Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: 1, email: 'test@example.com' },
      params: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('requireAdmin', () => {
    it('should allow access when user is admin of the project', async () => {
      req.params.projectId = '1';
      mockPrismaClient.projectMember.findFirst.mockResolvedValue({
        id: 1,
        user_id: 1,
        project_id: 1,
        role: 'Admin'
      });

      await requireAdmin(req, res, next);

      expect(mockPrismaClient.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          project_id: 1,
          role: 'Admin'
        }
      });
      expect(req.membership).toBeDefined();
      expect(req.membership.role).toBe('Admin');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access when user is not admin of the project', async () => {
      req.params.projectId = '1';
      mockPrismaClient.projectMember.findFirst.mockResolvedValue(null);

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Insufficient permissions to perform this action'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should get project ID from req.params.id if projectId not present', async () => {
      req.params.id = '2';
      mockPrismaClient.projectMember.findFirst.mockResolvedValue({
        id: 1,
        user_id: 1,
        project_id: 2,
        role: 'Admin'
      });

      await requireAdmin(req, res, next);

      expect(mockPrismaClient.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          project_id: 2,
          role: 'Admin'
        }
      });
      expect(next).toHaveBeenCalled();
    });

    it('should get project ID from req.body.project_id if params not present', async () => {
      req.body.project_id = 3;
      mockPrismaClient.projectMember.findFirst.mockResolvedValue({
        id: 1,
        user_id: 1,
        project_id: 3,
        role: 'Admin'
      });

      await requireAdmin(req, res, next);

      expect(mockPrismaClient.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          project_id: 3,
          role: 'Admin'
        }
      });
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when project ID is missing', async () => {
      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Project ID is required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error on database error', async () => {
      req.params.projectId = '1';
      const dbError = new Error('Database error');
      mockPrismaClient.projectMember.findFirst.mockRejectedValue(dbError);

      await requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('requireProjectMember', () => {
    it('should allow access when user is a member of the project', async () => {
      req.params.projectId = '1';
      mockPrismaClient.projectMember.findFirst.mockResolvedValue({
        id: 1,
        user_id: 1,
        project_id: 1,
        role: 'Member'
      });

      await requireProjectMember(req, res, next);

      expect(mockPrismaClient.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          project_id: 1
        }
      });
      expect(req.membership).toBeDefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access when user is admin of the project', async () => {
      req.params.projectId = '1';
      mockPrismaClient.projectMember.findFirst.mockResolvedValue({
        id: 1,
        user_id: 1,
        project_id: 1,
        role: 'Admin'
      });

      await requireProjectMember(req, res, next);

      expect(req.membership.role).toBe('Admin');
      expect(next).toHaveBeenCalled();
    });

    it('should deny access when user is not a member of the project', async () => {
      req.params.projectId = '1';
      mockPrismaClient.projectMember.findFirst.mockResolvedValue(null);

      await requireProjectMember(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Access denied to this project'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should get project ID from req.params.id if projectId not present', async () => {
      req.params.id = '2';
      mockPrismaClient.projectMember.findFirst.mockResolvedValue({
        id: 1,
        user_id: 1,
        project_id: 2,
        role: 'Member'
      });

      await requireProjectMember(req, res, next);

      expect(mockPrismaClient.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          project_id: 2
        }
      });
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when project ID is missing', async () => {
      await requireProjectMember(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Project ID is required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error on database error', async () => {
      req.params.projectId = '1';
      const dbError = new Error('Database error');
      mockPrismaClient.projectMember.findFirst.mockRejectedValue(dbError);

      await requireProjectMember(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('requireTaskOwnerOrAdmin', () => {
    it('should allow access when user is the task assignee', async () => {
      req.params.taskId = '1';
      mockPrismaClient.task.findUnique.mockResolvedValue({
        id: 1,
        title: 'Test Task',
        assigned_to: 1,
        project: {
          id: 1,
          members: [{
            id: 1,
            user_id: 1,
            project_id: 1,
            role: 'Member'
          }]
        }
      });

      await requireTaskOwnerOrAdmin(req, res, next);

      expect(mockPrismaClient.task.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          project: {
            include: {
              members: {
                where: { user_id: 1 }
              }
            }
          }
        }
      });
      expect(req.task).toBeDefined();
      expect(req.membership).toBeDefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access when user is admin of the project', async () => {
      req.params.taskId = '1';
      mockPrismaClient.task.findUnique.mockResolvedValue({
        id: 1,
        title: 'Test Task',
        assigned_to: 2, // Different user
        project: {
          id: 1,
          members: [{
            id: 1,
            user_id: 1,
            project_id: 1,
            role: 'Admin'
          }]
        }
      });

      await requireTaskOwnerOrAdmin(req, res, next);

      expect(req.task).toBeDefined();
      expect(req.membership.role).toBe('Admin');
      expect(next).toHaveBeenCalled();
    });

    it('should deny access when user is neither assignee nor admin', async () => {
      req.params.taskId = '1';
      mockPrismaClient.task.findUnique.mockResolvedValue({
        id: 1,
        title: 'Test Task',
        assigned_to: 2, // Different user
        project: {
          id: 1,
          members: [{
            id: 1,
            user_id: 1,
            project_id: 1,
            role: 'Member'
          }]
        }
      });

      await requireTaskOwnerOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Only task assignee or project admin can perform this action'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access when user is not a project member', async () => {
      req.params.taskId = '1';
      mockPrismaClient.task.findUnique.mockResolvedValue({
        id: 1,
        title: 'Test Task',
        assigned_to: 2,
        project: {
          id: 1,
          members: [] // User not a member
        }
      });

      await requireTaskOwnerOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Access denied to this task'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 when task does not exist', async () => {
      req.params.taskId = '999';
      mockPrismaClient.task.findUnique.mockResolvedValue(null);

      await requireTaskOwnerOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Task not found'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should get task ID from req.params.id if taskId not present', async () => {
      req.params.id = '1';
      mockPrismaClient.task.findUnique.mockResolvedValue({
        id: 1,
        title: 'Test Task',
        assigned_to: 1,
        project: {
          id: 1,
          members: [{
            id: 1,
            user_id: 1,
            project_id: 1,
            role: 'Member'
          }]
        }
      });

      await requireTaskOwnerOrAdmin(req, res, next);

      expect(mockPrismaClient.task.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          project: {
            include: {
              members: {
                where: { user_id: 1 }
              }
            }
          }
        }
      });
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when task ID is missing', async () => {
      await requireTaskOwnerOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Task ID is required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error on database error', async () => {
      req.params.taskId = '1';
      const dbError = new Error('Database error');
      mockPrismaClient.task.findUnique.mockRejectedValue(dbError);

      await requireTaskOwnerOrAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
