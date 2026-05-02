import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password.util.js';
import { generateAccessToken } from '../utils/jwt.util.js';
import projectRoutes from '../routes/project.routes.js';

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/projects', projectRoutes);

/**
 * Integration tests for project management API endpoints
 * Tests the full request flow including routes, middleware, and controllers
 * Validates Requirements 2.2, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
describe('Project API Integration Tests', () => {
  let testUser1, testUser2;
  let authToken1, authToken2;

  beforeAll(async () => {
    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        name: 'Test User 1',
        email: 'projecttest1@example.com',
        password_hash: await hashPassword('password123')
      }
    });

    testUser2 = await prisma.user.create({
      data: {
        name: 'Test User 2',
        email: 'projecttest2@example.com',
        password_hash: await hashPassword('password123')
      }
    });

    // Generate auth tokens
    authToken1 = generateAccessToken(testUser1);
    authToken2 = generateAccessToken(testUser2);
  });

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
  });

  afterAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'projecttest' }
      }
    });
    await prisma.$disconnect();
  });

  describe('POST /api/projects', () => {
    it('should create a project and add creator as Admin member', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ name: 'Test Project' })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'Test Project',
          created_by: testUser1.id,
          created_at: expect.any(String)
        })
      );

      // Verify creator was added as Admin member
      const membership = await prisma.projectMember.findFirst({
        where: {
          user_id: testUser1.id,
          project_id: response.body.id,
          role: 'Admin'
        }
      });
      expect(membership).toBeDefined();
    });

    it('should return 400 for empty project name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ name: '' })
        .expect(400);

      expect(response.body).toEqual({
        message: 'Project name is required'
      });
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' })
        .expect(401);
    });
  });

  describe('GET /api/projects', () => {
    it('should return all projects where user is a member', async () => {
      // Create projects
      const project1 = await prisma.project.create({
        data: {
          name: 'Project 1',
          created_by: testUser1.id
        }
      });

      const project2 = await prisma.project.create({
        data: {
          name: 'Project 2',
          created_by: testUser2.id
        }
      });

      // Add user1 as Admin to project1
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project1.id,
          role: 'Admin'
        }
      });

      // Add user1 as Member to project2
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project2.id,
          role: 'Member'
        }
      });

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: project1.id,
            name: 'Project 1',
            role: 'Admin',
            memberCount: 1,
            taskCount: 0
          }),
          expect.objectContaining({
            id: project2.id,
            name: 'Project 2',
            role: 'Member',
            memberCount: 1,
            taskCount: 0
          })
        ])
      );
    });

    it('should return empty array if user has no projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/projects')
        .expect(401);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return project details with members and tasks', async () => {
      // Create project
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      // Create a task
      await prisma.task.create({
        data: {
          title: 'Test Task',
          due_date: new Date('2024-12-31'),
          project_id: project.id,
          assigned_to: testUser1.id
        }
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: project.id,
          name: 'Test Project',
          created_by: testUser1.id,
          members: expect.arrayContaining([
            expect.objectContaining({
              user_id: testUser1.id,
              name: 'Test User 1',
              email: 'projecttest1@example.com',
              role: 'Admin'
            })
          ]),
          tasks: expect.arrayContaining([
            expect.objectContaining({
              title: 'Test Task',
              assigned_to: testUser1.id
            })
          ])
        })
      );
    });

    it('should return 403 if user is not a project member', async () => {
      // Create project with user2 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser2.id
        }
      });

      // Add user2 as member (not user1)
      await prisma.projectMember.create({
        data: {
          user_id: testUser2.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(403);

      expect(response.body).toEqual({
        message: 'Access denied to this project'
      });
    });

    it('should return 400 for invalid project ID', async () => {
      await request(app)
        .get('/api/projects/invalid')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/projects/1')
        .expect(401);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete project if user is the creator', async () => {
      // Create project
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      const response = await request(app)
        .delete(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Project deleted successfully'
      });

      // Verify project was deleted
      const deletedProject = await prisma.project.findUnique({
        where: { id: project.id }
      });
      expect(deletedProject).toBeNull();
    });

    it('should return 403 if user is not the creator', async () => {
      // Create project with user2 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser2.id
        }
      });

      // Add both users as Admin members
      await prisma.projectMember.create({
        data: {
          user_id: testUser2.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      const response = await request(app)
        .delete(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(403);

      expect(response.body).toEqual({
        message: 'Only the project creator can delete this project'
      });

      // Verify project was NOT deleted
      const existingProject = await prisma.project.findUnique({
        where: { id: project.id }
      });
      expect(existingProject).toBeDefined();
    });

    it('should return 403 if user is not an Admin', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin and user2 as Member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      await prisma.projectMember.create({
        data: {
          user_id: testUser2.id,
          project_id: project.id,
          role: 'Member'
        }
      });

      // Try to delete as Member (user2)
      await request(app)
        .delete(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(403);
    });

    it('should cascade delete tasks and memberships', async () => {
      // Create project
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add members
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      await prisma.projectMember.create({
        data: {
          user_id: testUser2.id,
          project_id: project.id,
          role: 'Member'
        }
      });

      // Create tasks
      await prisma.task.create({
        data: {
          title: 'Task 1',
          due_date: new Date('2024-12-31'),
          project_id: project.id,
          assigned_to: testUser1.id
        }
      });

      await request(app)
        .delete(`/api/projects/${project.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      // Verify tasks were cascade deleted
      const tasks = await prisma.task.findMany({
        where: { project_id: project.id }
      });
      expect(tasks).toHaveLength(0);

      // Verify memberships were cascade deleted
      const memberships = await prisma.projectMember.findMany({
        where: { project_id: project.id }
      });
      expect(memberships).toHaveLength(0);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .delete('/api/projects/1')
        .expect(401);
    });
  });

  describe('POST /api/projects/:id/members', () => {
    it('should add a member to a project with specified role', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      // Add user2 as Member
      const response = await request(app)
        .post(`/api/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          user_id: testUser2.id,
          role: 'Member'
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          user_id: testUser2.id,
          project_id: project.id,
          role: 'Member',
          joined_at: expect.any(String)
        })
      );

      // Verify member was added to database
      const membership = await prisma.projectMember.findFirst({
        where: {
          user_id: testUser2.id,
          project_id: project.id
        }
      });
      expect(membership).toBeDefined();
      expect(membership.role).toBe('Member');
    });

    it('should return 404 if user does not exist', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      // Try to add non-existent user
      const response = await request(app)
        .post(`/api/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          user_id: 99999,
          role: 'Member'
        })
        .expect(404);

      expect(response.body).toEqual({
        message: 'User not found'
      });
    });

    it('should return 400 if user is already a project member', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      // Add user2 as Member
      await prisma.projectMember.create({
        data: {
          user_id: testUser2.id,
          project_id: project.id,
          role: 'Member'
        }
      });

      // Try to add user2 again
      const response = await request(app)
        .post(`/api/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          user_id: testUser2.id,
          role: 'Admin'
        })
        .expect(400);

      expect(response.body).toEqual({
        message: 'User is already a member of this project'
      });
    });

    it('should return 403 if user is not an Admin', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin and user2 as Member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      await prisma.projectMember.create({
        data: {
          user_id: testUser2.id,
          project_id: project.id,
          role: 'Member'
        }
      });

      // Create a third user to try to add
      const testUser3 = await prisma.user.create({
        data: {
          name: 'Test User 3',
          email: 'projecttest3@example.com',
          password_hash: await hashPassword('password123')
        }
      });

      // Try to add user3 as Member (using user2's token who is a Member)
      await request(app)
        .post(`/api/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          user_id: testUser3.id,
          role: 'Member'
        })
        .expect(403);

      // Clean up
      await prisma.user.delete({ where: { id: testUser3.id } });
    });

    it('should return 400 for invalid user_id', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      // Try to add with invalid user_id
      await request(app)
        .post(`/api/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          user_id: 'invalid',
          role: 'Member'
        })
        .expect(400);
    });

    it('should return 400 for invalid role', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      // Try to add with invalid role
      await request(app)
        .post(`/api/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          user_id: testUser2.id,
          role: 'InvalidRole'
        })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/projects/1/members')
        .send({
          user_id: 1,
          role: 'Member'
        })
        .expect(401);
    });
  });

  describe('DELETE /api/projects/:id/members/:userId', () => {
    it('should remove a member from a project and unassign their tasks', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add both users as members
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      await prisma.projectMember.create({
        data: {
          user_id: testUser2.id,
          project_id: project.id,
          role: 'Member'
        }
      });

      // Create tasks assigned to user2
      const task1 = await prisma.task.create({
        data: {
          title: 'Task 1',
          due_date: new Date('2024-12-31'),
          project_id: project.id,
          assigned_to: testUser2.id
        }
      });

      const task2 = await prisma.task.create({
        data: {
          title: 'Task 2',
          due_date: new Date('2024-12-31'),
          project_id: project.id,
          assigned_to: testUser2.id
        }
      });

      // Remove user2 from project
      const response = await request(app)
        .delete(`/api/projects/${project.id}/members/${testUser2.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Member removed successfully'
      });

      // Verify member was removed from database
      const membership = await prisma.projectMember.findFirst({
        where: {
          user_id: testUser2.id,
          project_id: project.id
        }
      });
      expect(membership).toBeNull();

      // Verify tasks were unassigned
      const unassignedTask1 = await prisma.task.findUnique({
        where: { id: task1.id }
      });
      expect(unassignedTask1.assigned_to).toBeNull();

      const unassignedTask2 = await prisma.task.findUnique({
        where: { id: task2.id }
      });
      expect(unassignedTask2.assigned_to).toBeNull();
    });

    it('should return 403 when attempting to remove project creator', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin member (creator)
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      // Try to remove creator
      const response = await request(app)
        .delete(`/api/projects/${project.id}/members/${testUser1.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(403);

      expect(response.body).toEqual({
        message: 'Cannot remove project creator from the project'
      });

      // Verify member was NOT removed
      const membership = await prisma.projectMember.findFirst({
        where: {
          user_id: testUser1.id,
          project_id: project.id
        }
      });
      expect(membership).toBeDefined();
    });

    it('should return 404 if user is not a project member', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add only user1 as member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      // Try to remove user2 who is not a member
      const response = await request(app)
        .delete(`/api/projects/${project.id}/members/${testUser2.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(404);

      expect(response.body).toEqual({
        message: 'User is not a member of this project'
      });
    });

    it('should return 403 if user is not an Admin', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin and user2 as Member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      await prisma.projectMember.create({
        data: {
          user_id: testUser2.id,
          project_id: project.id,
          role: 'Member'
        }
      });

      // Create a third user
      const testUser3 = await prisma.user.create({
        data: {
          name: 'Test User 3',
          email: 'projecttest3@example.com',
          password_hash: await hashPassword('password123')
        }
      });

      await prisma.projectMember.create({
        data: {
          user_id: testUser3.id,
          project_id: project.id,
          role: 'Member'
        }
      });

      // Try to remove user3 as Member (using user2's token who is a Member)
      await request(app)
        .delete(`/api/projects/${project.id}/members/${testUser3.id}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(403);

      // Clean up
      await prisma.projectMember.deleteMany({ where: { user_id: testUser3.id } });
      await prisma.user.delete({ where: { id: testUser3.id } });
    });

    it('should only unassign tasks from the specific project', async () => {
      // Create two projects
      const project1 = await prisma.project.create({
        data: {
          name: 'Project 1',
          created_by: testUser1.id
        }
      });

      const project2 = await prisma.project.create({
        data: {
          name: 'Project 2',
          created_by: testUser1.id
        }
      });

      // Add members to both projects
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project1.id,
          role: 'Admin'
        }
      });

      await prisma.projectMember.create({
        data: {
          user_id: testUser2.id,
          project_id: project1.id,
          role: 'Member'
        }
      });

      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project2.id,
          role: 'Admin'
        }
      });

      await prisma.projectMember.create({
        data: {
          user_id: testUser2.id,
          project_id: project2.id,
          role: 'Member'
        }
      });

      // Create tasks in both projects assigned to user2
      const task1 = await prisma.task.create({
        data: {
          title: 'Task in Project 1',
          due_date: new Date('2024-12-31'),
          project_id: project1.id,
          assigned_to: testUser2.id
        }
      });

      const task2 = await prisma.task.create({
        data: {
          title: 'Task in Project 2',
          due_date: new Date('2024-12-31'),
          project_id: project2.id,
          assigned_to: testUser2.id
        }
      });

      // Remove user2 from project1 only
      await request(app)
        .delete(`/api/projects/${project1.id}/members/${testUser2.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      // Verify task in project1 was unassigned
      const unassignedTask1 = await prisma.task.findUnique({
        where: { id: task1.id }
      });
      expect(unassignedTask1.assigned_to).toBeNull();

      // Verify task in project2 is still assigned
      const stillAssignedTask2 = await prisma.task.findUnique({
        where: { id: task2.id }
      });
      expect(stillAssignedTask2.assigned_to).toBe(testUser2.id);

      // Verify user2 is still a member of project2
      const project2Membership = await prisma.projectMember.findFirst({
        where: {
          user_id: testUser2.id,
          project_id: project2.id
        }
      });
      expect(project2Membership).toBeDefined();
    });

    it('should return 400 for invalid userId parameter', async () => {
      // Create project with user1 as creator
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          created_by: testUser1.id
        }
      });

      // Add user1 as Admin member
      await prisma.projectMember.create({
        data: {
          user_id: testUser1.id,
          project_id: project.id,
          role: 'Admin'
        }
      });

      // Try to remove with invalid userId
      await request(app)
        .delete(`/api/projects/${project.id}/members/invalid`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .delete('/api/projects/1/members/1')
        .expect(401);
    });
  });
});
