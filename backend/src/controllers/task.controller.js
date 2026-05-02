import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create task endpoint - Create a new task (Admin only)
 * POST /api/tasks
 * Requirements: 2.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
export async function createTask(req, res) {
  try {
    const { title, description, due_date, assigned_to, project_id } = req.body;
    const userId = req.user.id;

    // Validate title is not empty (additional check beyond middleware)
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        message: 'Task title is required'
      });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: project_id }
    });

    if (!project) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    // Verify user is an Admin of the project
    const membership = await prisma.projectMember.findFirst({
      where: {
        user_id: userId,
        project_id: project_id,
        role: 'Admin'
      }
    });

    if (!membership) {
      return res.status(403).json({
        message: 'Only project admins can create tasks'
      });
    }

    // If assignee is provided, verify they are a member of the project
    if (assigned_to) {
      const assigneeMembership = await prisma.projectMember.findFirst({
        where: {
          user_id: assigned_to,
          project_id: project_id
        }
      });

      if (!assigneeMembership) {
        return res.status(400).json({
          message: 'Assignee must be a member of the project'
        });
      }
    }

    // Create task with initial status "To Do"
    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        due_date: new Date(due_date),
        assigned_to: assigned_to || null,
        project_id: project_id,
        status: 'TODO' // Initial status
      }
    });

    return res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Get tasks endpoint - Get tasks with optional filters
 * GET /api/tasks
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export async function getTasks(req, res) {
  try {
    const userId = req.user.id;
    const { project_id, status, assigned_to_me } = req.query;

    // Build where clause
    const where = {};

    // Get all projects where user is a member
    const userProjects = await prisma.projectMember.findMany({
      where: { user_id: userId },
      select: { project_id: true }
    });

    const projectIds = userProjects.map(pm => pm.project_id);

    // Filter by projects where user is a member
    where.project_id = { in: projectIds };

    // Apply project filter if provided
    if (project_id) {
      const projectIdInt = parseInt(project_id);
      // Verify user is a member of this project
      if (!projectIds.includes(projectIdInt)) {
        return res.status(403).json({
          message: 'Access denied to this project'
        });
      }
      where.project_id = projectIdInt;
    }

    // Apply status filter if provided
    if (status) {
      // Map display status to database enum
      const statusMap = {
        'To Do': 'TODO',
        'In Progress': 'IN_PROGRESS',
        'Done': 'DONE'
      };
      where.status = statusMap[status];
    }

    // Apply assigned_to_me filter if provided
    if (assigned_to_me === 'true') {
      where.assigned_to = userId;
    }

    // Fetch tasks with related data
    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Transform tasks to include assignee_name and project_name
    const transformedTasks = tasks.map(task => {
      // Map database enum to display status
      const statusMap = {
        'TODO': 'To Do',
        'IN_PROGRESS': 'In Progress',
        'DONE': 'Done'
      };

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: statusMap[task.status],
        due_date: task.due_date,
        assigned_to: task.assigned_to,
        assignee_name: task.assignee ? task.assignee.name : null,
        project_id: task.project_id,
        project_name: task.project.name,
        created_at: task.created_at,
        updated_at: task.updated_at
      };
    });

    return res.status(200).json(transformedTasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Update task status endpoint - Update task status
 * PATCH /api/tasks/:id/status
 * Requirements: 2.8, 6.1, 6.2, 6.3, 6.4, 6.5
 */
export async function updateTaskStatus(req, res) {
  try {
    const taskId = parseInt(req.params.id);
    const { status } = req.body;
    const userId = req.user.id;

    // Fetch task with project membership info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            members: {
              where: { user_id: userId }
            }
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({
        message: 'Task not found'
      });
    }

    const membership = task.project.members[0];

    if (!membership) {
      return res.status(403).json({
        message: 'Access denied to this task'
      });
    }

    // Check authorization: Admin or task assignee
    const isAdmin = membership.role === 'Admin';
    const isAssignee = task.assigned_to === userId;

    if (!isAdmin && !isAssignee) {
      return res.status(403).json({
        message: 'Only task assignee or project admin can update task status'
      });
    }

    // Map display status to database enum
    const statusMap = {
      'To Do': 'TODO',
      'In Progress': 'IN_PROGRESS',
      'Done': 'DONE'
    };

    // Update task status
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: statusMap[status]
      }
    });

    // Transform response to use display status
    const reverseStatusMap = {
      'TODO': 'To Do',
      'IN_PROGRESS': 'In Progress',
      'DONE': 'Done'
    };

    return res.status(200).json({
      ...updatedTask,
      status: reverseStatusMap[updatedTask.status]
    });
  } catch (error) {
    console.error('Update task status error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Delete task endpoint - Delete a task (Admin only)
 * DELETE /api/tasks/:id
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
export async function deleteTask(req, res) {
  try {
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    // Fetch task with project membership info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            members: {
              where: { user_id: userId }
            }
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({
        message: 'Task not found'
      });
    }

    const membership = task.project.members[0];

    if (!membership) {
      return res.status(403).json({
        message: 'Access denied to this task'
      });
    }

    // Verify user is an Admin of the project
    if (membership.role !== 'Admin') {
      return res.status(403).json({
        message: 'Only project admins can delete tasks'
      });
    }

    // Delete task
    await prisma.task.delete({
      where: { id: taskId }
    });

    return res.status(200).json({
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}
