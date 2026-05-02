import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware to require Admin role for a project
 * Verifies that the authenticated user has Admin role in the specified project
 * @param {Object} req - Express request object (expects req.user.id and req.params.projectId or req.body.project_id)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export async function requireAdmin(req, res, next) {
  try {
    // Get project ID from params or body
    const projectId = req.params.projectId || req.params.id || req.body.project_id;
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }
    
    // Check if user is admin of the project
    const membership = await prisma.projectMember.findFirst({
      where: {
        user_id: req.user.id,
        project_id: parseInt(projectId),
        role: 'Admin'
      }
    });
    
    if (!membership) {
      return res.status(403).json({ 
        message: 'Insufficient permissions to perform this action' 
      });
    }
    
    // Attach membership info to request for use in subsequent middleware/routes
    req.membership = membership;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require project membership
 * Verifies that the authenticated user is a member of the specified project (any role)
 * @param {Object} req - Express request object (expects req.user.id and req.params.projectId or req.params.id)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export async function requireProjectMember(req, res, next) {
  try {
    // Get project ID from params
    const projectId = req.params.projectId || req.params.id;
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }
    
    const membership = await prisma.projectMember.findFirst({
      where: {
        user_id: req.user.id,
        project_id: parseInt(projectId)
      }
    });
    
    if (!membership) {
      return res.status(403).json({ 
        message: 'Access denied to this project' 
      });
    }
    
    // Attach membership info to request for use in subsequent middleware/routes
    req.membership = membership;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require task owner or admin role
 * Verifies that the authenticated user is either:
 * - The assignee of the task, OR
 * - An Admin of the project containing the task
 * @param {Object} req - Express request object (expects req.user.id and req.params.taskId or req.params.id)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export async function requireTaskOwnerOrAdmin(req, res, next) {
  try {
    // Get task ID from params
    const taskId = req.params.taskId || req.params.id;
    
    if (!taskId) {
      return res.status(400).json({ message: 'Task ID is required' });
    }
    
    // Fetch task with project membership info
    const task = await prisma.task.findUnique({
      where: { id: parseInt(taskId) },
      include: {
        project: {
          include: {
            members: {
              where: { user_id: req.user.id }
            }
          }
        }
      }
    });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    const membership = task.project.members[0];
    
    if (!membership) {
      return res.status(403).json({ message: 'Access denied to this task' });
    }
    
    // Allow if admin or task assignee
    if (membership.role === 'Admin' || task.assigned_to === req.user.id) {
      // Attach task and membership info to request
      req.task = task;
      req.membership = membership;
      next();
    } else {
      return res.status(403).json({ 
        message: 'Only task assignee or project admin can perform this action' 
      });
    }
  } catch (error) {
    next(error);
  }
}
