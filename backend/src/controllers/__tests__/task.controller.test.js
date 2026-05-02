import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../utils/password.util.js';
import {
  createTask,
  getTasks,
  updateTaskStatus,
  deleteTask
} from '../task.controller.js';

const prisma = new PrismaClient();

/**
 * Integration tests for task management endpoints
 * Validates Requirements 2.6, 2.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4
 */
describe('Task Controller', () => {
  let testUser1, testUser2, testUser3;
  let testProject1, testProject2;
  let req, res;

  // Helper function to create mock response object
  function createMockResponse() {
    const res = {
      statusCode: null,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      }
    };
    return res;
  }

  beforeEach(async () => {
    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        name: 'Test User 1',
        email: 'testuser1@example.com',
        password_hash: await hashPassword('password123')
      }
    });

    testUser2 = await prisma.user.create({
      data: {
        name: 'Test User 2',
        email: 'testuser2@example.com',
        password_hash: await hashPassword('password123')
      }
    });

    testUser3 = await prisma.user.create({
      data: {
        name: 'Test User 3',
        email: 'testuser3@example.com',
        password_hash: await hashPassword('password123')
      }
    });

    // Create test projects
    testProject1 = await prisma.project.create({
      data: {
        name: 'Test Project 1',
        created_by: testUser1.id
      }
    });

    testProject2 = await prisma.project.create({
      data: {
        name: 'Test Project 2',
        created_by: testUser2.id
      }
    });

    // Add user1 as Admin to project1
    await prisma.projectMember.create({
      data: {
        user_id: testUser1.id,
        project_id: testProject1.id,
        role: 'Admin'
      }
    });

    // Add user2 as Admin to project2
    await prisma.projectMember.create({
      data: {
        user_id: testUser2.id,
        project_id: testProject2.id,
        role: 'Admin'
      }
    });

    // Add user2 as Member to project1
    await prisma.projectMember.create({
      data: {
        user_id: testUser2.id,
        project_id: testProject1.id,
        role: 'Member'
      }
    });

    // Mock request and response objects
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: testUser1.id, email: testUser1.email }
    };

    res = createMockResponse();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'testuser' }
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('createTask', () => {
    it('should create a task with all fields', async () => {
      req.body = {
        title: 'Test Task',
        description: 'Test Description',
        due_date: '2024-12-31',
        assigned_to: testUser2.id,
        project_id: testProject1.id
      };

      await createTask(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          title: 'Test Task',
          description: 'Test Description',
          status: 'TODO',
          due_date: expect.any(Date),
          assigned_to: testUser2.id,
          project_id: testProject1.id,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      );

      // Verify task was created in database
      const task = await prisma.task.findFirst({
        where: { title: 'Test Task' }
      });
      expect(task).toBeDefined();
      expect(task.status).toBe('TODO');
    });

    it('should create an unassigned task', async () => {
      req.body = {
        title: 'Unassigned Task',
        description: 'No assignee',
        due_date: '2024-12-31',
        project_id: testProject1.id
      };

      await createTask(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData.assigned_to).toBeNull();

      // Verify task was created with null assignee
      const task = await prisma.task.findFirst({
        where: { title: 'Unassigned Task' }
      });
      expect(task.assigned_to).toBeNull();
    });

    it('should create task without description', async () => {
      req.body = {
        title: 'Task Without Description',
        due_date: '2024-12-31',
        assigned_to: testUser2.id,
        project_id: testProject1.id
      };

      await createTask(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData.description).toBeNull();
    });

    it('should reject empty task title', async () => {
      req.body = {
        title: '   ',
        due_date: '2024-12-31',
        project_id: testProject1.id
      };

      await createTask(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Task title is required'
      });
    });

    it('should trim task title and description', async () => {
      req.body = {
        title: '  Test Task  ',
        description: '  Test Description  ',
        due_date: '2024-12-31',
        project_id: testProject1.id
      };

      await createTask(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData.title).toBe('Test Task');
      expect(res.jsonData.description).toBe('Test Description');
    });

    it('should return 404 if project does not exist', async () => {
      req.body = {
        title: 'Test Task',
        due_date: '2024-12-31',
        project_id: 99999
      };

      await createTask(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.jsonData).toEqual({
        message: 'Project not found'
      });
    });

    it('should return 403 if user is not an Admin of the project', async () => {
      // User1 is not a member of project2
      req.body = {
        title: 'Test Task',
        due_date: '2024-12-31',
        project_id: testProject2.id
      };

      await createTask(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData).toEqual({
        message: 'Only project admins can create tasks'
      });
    });

    it('should return 403 if user is a Member (not Admin) of the project', async () => {
      // User2 is a Member of project1, not Admin
      req.user = { id: testUser2.id, email: testUser2.email };

      req.body = {
        title: 'Test Task',
        due_date: '2024-12-31',
        project_id: testProject1.id
      };

      await createTask(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData).toEqual({
        message: 'Only project admins can create tasks'
      });
    });

    it('should return 400 if assignee is not a project member', async () => {
      // User3 is not a member of project1
      req.body = {
        title: 'Test Task',
        due_date: '2024-12-31',
        assigned_to: testUser3.id,
        project_id: testProject1.id
      };

      await createTask(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        message: 'Assignee must be a member of the project'
      });
    });

    it('should allow assigning task to any project member', async () => {
      // User2 is a member of project1
      req.body = {
        title: 'Test Task',
        due_date: '2024-12-31',
        assigned_to: testUser2.id,
        project_id: testProject1.id
      };

      await createTask(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData.assigned_to).toBe(testUser2.id);
    });
  });

  describe('getTasks', () => {
    beforeEach(async () => {
      // Create tasks in project1
      await prisma.task.create({
        data: {
          title: 'Task 1 - To Do',
          due_date: new Date('2024-12-31'),
          status: 'TODO',
          assigned_to: testUser1.id,
          project_id: testProject1.id
        }
      });

      await prisma.task.create({
        data: {
          title: 'Task 2 - In Progress',
          due_date: new Date('2024-12-15'),
          status: 'IN_PROGRESS',
          assigned_to: testUser2.id,
          project_id: testProject1.id
        }
      });

      await prisma.task.create({
        data: {
          title: 'Task 3 - Done',
          due_date: new Date('2024-11-30'),
          status: 'DONE',
          assigned_to: testUser1.id,
          project_id: testProject1.id
        }
      });

      // Create task in project2
      await prisma.task.create({
        data: {
          title: 'Task 4 - Project 2',
          due_date: new Date('2024-12-31'),
          status: 'TODO',
          assigned_to: testUser2.id,
          project_id: testProject2.id
        }
      });
    });

    it('should return all tasks from projects where user is a member', async () => {
      await getTasks(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toHaveLength(3); // User1 is member of project1 only
      expect(res.jsonData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Task 1 - To Do',
            status: 'To Do',
            project_name: 'Test Project 1'
          }),
          expect.objectContaining({
            title: 'Task 2 - In Progress',
            status: 'In Progress',
            project_name: 'Test Project 1'
          }),
          expect.objectContaining({
            title: 'Task 3 - Done',
            status: 'Done',
            project_name: 'Test Project 1'
          })
        ])
      );
    });

    it('should include all task details and related data', async () => {
      await getTasks(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.length).toBeGreaterThan(0);
      
      const task = res.jsonData[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('description');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('due_date');
      expect(task).toHaveProperty('assigned_to');
      expect(task).toHaveProperty('assignee_name');
      expect(task).toHaveProperty('project_id');
      expect(task).toHaveProperty('project_name');
      expect(task).toHaveProperty('created_at');
      expect(task).toHaveProperty('updated_at');
    });

    it('should filter tasks by project_id', async () => {
      req.query.project_id = testProject1.id.toString();

      await getTasks(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toHaveLength(3);
      expect(res.jsonData.every(task => task.project_id === testProject1.id)).toBe(true);
    });

    it('should filter tasks by status', async () => {
      req.query.status = 'To Do';

      await getTasks(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toHaveLength(1);
      expect(res.jsonData[0].status).toBe('To Do');
    });

    it('should filter tasks by assigned_to_me', async () => {
      req.query.assigned_to_me = 'true';

      await getTasks(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toHaveLength(2); // Task 1 and Task 3 assigned to user1
      expect(res.jsonData.every(task => task.assigned_to === testUser1.id)).toBe(true);
    });

    it('should combine multiple filters', async () => {
      req.query.project_id = testProject1.id.toString();
      req.query.status = 'To Do';

      await getTasks(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toHaveLength(1);
      expect(res.jsonData[0].title).toBe('Task 1 - To Do');
    });

    it('should return 403 if user tries to filter by project they are not a member of', async () => {
      req.query.project_id = testProject2.id.toString();

      await getTasks(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData).toEqual({
        message: 'Access denied to this project'
      });
    });

    it('should return empty array if no tasks match filters', async () => {
      req.query.status = 'Done';
      req.query.assigned_to_me = 'true';

      await getTasks(req, res);

      expect(res.statusCode).toBe(200);
      // Task 3 is Done and assigned to user1, so should return 1 task
      expect(res.jsonData).toHaveLength(1);
    });

    it('should map database status to display status correctly', async () => {
      await getTasks(req, res);

      expect(res.statusCode).toBe(200);
      const statuses = res.jsonData.map(task => task.status);
      expect(statuses).toContain('To Do');
      expect(statuses).toContain('In Progress');
      expect(statuses).toContain('Done');
      expect(statuses).not.toContain('TODO');
      expect(statuses).not.toContain('IN_PROGRESS');
      expect(statuses).not.toContain('DONE');
    });
  });

  describe('updateTaskStatus', () => {
    let testTask;

    beforeEach(async () => {
      // Create a task assigned to user2
      testTask = await prisma.task.create({
        data: {
          title: 'Test Task',
          due_date: new Date('2024-12-31'),
          status: 'TODO',
          assigned_to: testUser2.id,
          project_id: testProject1.id
        }
      });
    });

    it('should allow Admin to update task status', async () => {
      // User1 is Admin of project1
      req.params.id = testTask.id.toString();
      req.body = { status: 'In Progress' };

      await updateTaskStatus(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual(
        expect.objectContaining({
          id: testTask.id,
          status: 'In Progress',
          updated_at: expect.any(Date)
        })
      );

      // Verify status was updated in database
      const updatedTask = await prisma.task.findUnique({
        where: { id: testTask.id }
      });
      expect(updatedTask.status).toBe('IN_PROGRESS');
    });

    it('should allow task assignee to update task status', async () => {
      // User2 is the assignee
      req.user = { id: testUser2.id, email: testUser2.email };
      req.params.id = testTask.id.toString();
      req.body = { status: 'Done' };

      await updateTaskStatus(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.status).toBe('Done');

      // Verify status was updated in database
      const updatedTask = await prisma.task.findUnique({
        where: { id: testTask.id }
      });
      expect(updatedTask.status).toBe('DONE');
    });

    it('should return 403 if user is neither Admin nor assignee', async () => {
      // User3 is not a member of project1
      req.user = { id: testUser3.id, email: testUser3.email };
      req.params.id = testTask.id.toString();
      req.body = { status: 'In Progress' };

      await updateTaskStatus(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData).toEqual({
        message: 'Access denied to this task'
      });
    });

    it('should return 403 if Member (not assignee) tries to update task', async () => {
      // Create task assigned to user1
      const task = await prisma.task.create({
        data: {
          title: 'Another Task',
          due_date: new Date('2024-12-31'),
          status: 'TODO',
          assigned_to: testUser1.id,
          project_id: testProject1.id
        }
      });

      // User2 is a Member of project1 but not the assignee
      req.user = { id: testUser2.id, email: testUser2.email };
      req.params.id = task.id.toString();
      req.body = { status: 'In Progress' };

      await updateTaskStatus(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData).toEqual({
        message: 'Only task assignee or project admin can update task status'
      });
    });

    it('should return 404 if task does not exist', async () => {
      req.params.id = '99999';
      req.body = { status: 'In Progress' };

      await updateTaskStatus(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.jsonData).toEqual({
        message: 'Task not found'
      });
    });

    it('should update all valid status values', async () => {
      const statuses = ['To Do', 'In Progress', 'Done'];

      for (const status of statuses) {
        req.params.id = testTask.id.toString();
        req.body = { status };

        await updateTaskStatus(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.status).toBe(status);
      }
    });

    it('should update updated_at timestamp', async () => {
      const originalTask = await prisma.task.findUnique({
        where: { id: testTask.id }
      });

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      req.params.id = testTask.id.toString();
      req.body = { status: 'In Progress' };

      await updateTaskStatus(req, res);

      expect(res.statusCode).toBe(200);

      const updatedTask = await prisma.task.findUnique({
        where: { id: testTask.id }
      });

      expect(updatedTask.updated_at.getTime()).toBeGreaterThan(
        originalTask.updated_at.getTime()
      );
    });
  });

  describe('deleteTask', () => {
    let testTask;

    beforeEach(async () => {
      // Create a task
      testTask = await prisma.task.create({
        data: {
          title: 'Test Task',
          due_date: new Date('2024-12-31'),
          status: 'TODO',
          assigned_to: testUser2.id,
          project_id: testProject1.id
        }
      });
    });

    it('should allow Admin to delete task', async () => {
      // User1 is Admin of project1
      req.params.id = testTask.id.toString();

      await deleteTask(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        message: 'Task deleted successfully'
      });

      // Verify task was deleted from database
      const deletedTask = await prisma.task.findUnique({
        where: { id: testTask.id }
      });
      expect(deletedTask).toBeNull();
    });

    it('should return 403 if Member tries to delete task', async () => {
      // User2 is a Member of project1
      req.user = { id: testUser2.id, email: testUser2.email };
      req.params.id = testTask.id.toString();

      await deleteTask(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData).toEqual({
        message: 'Only project admins can delete tasks'
      });

      // Verify task was NOT deleted
      const existingTask = await prisma.task.findUnique({
        where: { id: testTask.id }
      });
      expect(existingTask).toBeDefined();
    });

    it('should return 403 if user is not a project member', async () => {
      // User3 is not a member of project1
      req.user = { id: testUser3.id, email: testUser3.email };
      req.params.id = testTask.id.toString();

      await deleteTask(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData).toEqual({
        message: 'Access denied to this task'
      });
    });

    it('should return 404 if task does not exist', async () => {
      req.params.id = '99999';

      await deleteTask(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.jsonData).toEqual({
        message: 'Task not found'
      });
    });

    it('should allow task assignee who is also Admin to delete task', async () => {
      // Create task assigned to user1 (who is Admin)
      const task = await prisma.task.create({
        data: {
          title: 'Admin Task',
          due_date: new Date('2024-12-31'),
          status: 'TODO',
          assigned_to: testUser1.id,
          project_id: testProject1.id
        }
      });

      req.params.id = task.id.toString();

      await deleteTask(req, res);

      expect(res.statusCode).toBe(200);

      // Verify task was deleted
      const deletedTask = await prisma.task.findUnique({
        where: { id: task.id }
      });
      expect(deletedTask).toBeNull();
    });
  });
});
