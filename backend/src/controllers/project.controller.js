import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create project endpoint - Create a new project (Admin only)
 * POST /api/projects
 * Requirements: 2.2, 3.1, 3.5, 3.6
 */
export async function createProject(req, res) {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    // Validate project name is not empty (additional check beyond middleware)
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        message: 'Project name is required'
      });
    }

    // Create project with transaction to ensure creator is added as Admin member
    const result = await prisma.$transaction(async (tx) => {
      // Create the project
      const project = await tx.project.create({
        data: {
          name: name.trim(),
          created_by: userId
        }
      });

      // Automatically add creator as Admin member
      await tx.projectMember.create({
        data: {
          user_id: userId,
          project_id: project.id,
          role: 'Admin'
        }
      });

      return project;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Get all projects endpoint - Return all projects where user is a member
 * GET /api/projects
 * Requirements: 3.2
 */
export async function getProjects(req, res) {
  try {
    const userId = req.user.id;

    // Get all projects where user is a member
    const projectMembers = await prisma.projectMember.findMany({
      where: {
        user_id: userId
      },
      include: {
        project: {
          include: {
            _count: {
              select: {
                members: true,
                tasks: true
              }
            }
          }
        }
      }
    });

    // Transform the data to include role, memberCount, and taskCount
    const projects = projectMembers.map(pm => ({
      id: pm.project.id,
      name: pm.project.name,
      created_by: pm.project.created_by,
      created_at: pm.project.created_at,
      role: pm.role,
      memberCount: pm.project._count.members,
      taskCount: pm.project._count.tasks
    }));

    return res.status(200).json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Get project by ID endpoint - Return project details with members and tasks
 * GET /api/projects/:id
 * Requirements: 3.3
 */
export async function getProjectById(req, res) {
  try {
    const projectId = parseInt(req.params.id);
    const userId = req.user.id;

    // Verify user is project member (handled by middleware, but double-check)
    const membership = await prisma.projectMember.findFirst({
      where: {
        user_id: userId,
        project_id: projectId
      }
    });

    if (!membership) {
      return res.status(403).json({
        message: 'Access denied to this project'
      });
    }

    // Get project with members and tasks
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            due_date: true,
            assigned_to: true
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    // Transform members data to flatten user info
    const transformedProject = {
      id: project.id,
      name: project.name,
      created_by: project.created_by,
      created_at: project.created_at,
      members: project.members.map(m => ({
        id: m.id,
        user_id: m.user_id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joined_at: m.joined_at
      })),
      tasks: project.tasks
    };

    return res.status(200).json(transformedProject);
  } catch (error) {
    console.error('Get project by ID error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Delete project endpoint - Delete a project (Admin only, must be creator)
 * DELETE /api/projects/:id
 * Requirements: 2.4, 2.5, 3.4
 */
export async function deleteProject(req, res) {
  try {
    const projectId = parseInt(req.params.id);
    const userId = req.user.id;

    // Get project to verify creator
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    // Verify user is the project creator
    if (project.created_by !== userId) {
      return res.status(403).json({
        message: 'Only the project creator can delete this project'
      });
    }

    // Delete project (cascade will handle tasks and memberships)
    await prisma.project.delete({
      where: { id: projectId }
    });

    return res.status(200).json({
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Add project member endpoint - Add a member to a project (Admin only)
 * POST /api/projects/:id/members
 * Requirements: 2.6, 4.1, 4.3, 4.5
 */
export async function addProjectMember(req, res) {
  try {
    const projectId = parseInt(req.params.id);
    const { user_id, role } = req.body;

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: user_id }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Check if user is already a project member
    const existingMember = await prisma.projectMember.findFirst({
      where: {
        user_id: user_id,
        project_id: projectId
      }
    });

    if (existingMember) {
      return res.status(400).json({
        message: 'User is already a member of this project'
      });
    }

    // Create project member record
    const projectMember = await prisma.projectMember.create({
      data: {
        user_id: user_id,
        project_id: projectId,
        role: role
      }
    });

    return res.status(201).json(projectMember);
  } catch (error) {
    console.error('Add project member error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

/**
 * Remove project member endpoint - Remove a member from a project (Admin only)
 * DELETE /api/projects/:id/members/:userId
 * Requirements: 2.7, 4.2, 4.4, 4.6
 */
export async function removeProjectMember(req, res) {
  try {
    const projectId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    // Get project to verify it exists and check creator
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    // Prevent removal of project creator
    if (project.created_by === userId) {
      return res.status(403).json({
        message: 'Cannot remove project creator from the project'
      });
    }

    // Check if user is a project member
    const projectMember = await prisma.projectMember.findFirst({
      where: {
        user_id: userId,
        project_id: projectId
      }
    });

    if (!projectMember) {
      return res.status(404).json({
        message: 'User is not a member of this project'
      });
    }

    // Use transaction to unassign tasks and remove member
    await prisma.$transaction(async (tx) => {
      // Unassign all tasks assigned to this user in this project
      await tx.task.updateMany({
        where: {
          project_id: projectId,
          assigned_to: userId
        },
        data: {
          assigned_to: null
        }
      });

      // Delete the ProjectMember record
      await tx.projectMember.delete({
        where: {
          id: projectMember.id
        }
      });
    });

    return res.status(200).json({
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Remove project member error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}
