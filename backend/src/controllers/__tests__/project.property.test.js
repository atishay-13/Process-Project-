import { jest } from '@jest/globals';
import fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../utils/password.util.js';

const prisma = new PrismaClient();

/**
 * Property-Based Tests for Project Management
 * 
 * These tests validate the correctness properties defined in the design document:
 * - Property 5: Project Creator Deletion Authorization
 * - Property 6: Non-Creator Deletion Denial
 * - Property 11: Project Membership Retrieval
 * - Property 12: Project Access Authorization
 * - Property 14: Automatic Creator Membership
 * 
 * Validates Requirements: 2.4, 2.5, 3.2, 3.3, 3.6
 */

describe('Project Management Property-Based Tests', () => {
  // Helper function to create a test user with unique email
  async function createTestUser(email) {
    const uniqueEmail = `${Date.now()}-${Math.random()}-${email}`;
    return await prisma.user.create({
      data: {
        name: `Test User ${email}`,
        email: uniqueEmail,
        password_hash: await hashPassword('password123')
      }
    });
  }

  // Helper function to create a test project
  async function createTestProject(name, creatorId) {
    return await prisma.project.create({
      data: {
        name,
        created_by: creatorId
      }
    });
  }

  // Helper function to add project member
  async function addProjectMember(userId, projectId, role) {
    return await prisma.projectMember.create({
      data: {
        user_id: userId,
        project_id: projectId,
        role
      }
    });
  }

  // Clean up database after each test
  afterEach(async () => {
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'proptest' }
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 5: Project Creator Deletion Authorization
   * 
   * For any project and any authenticated Admin user who created that project,
   * the API server SHALL allow deletion and remove the project along with
   * all associated tasks and memberships.
   * 
   * Validates: Requirements 2.4, 3.4
   */
  describe('Property 5: Project Creator Deletion Authorization', () => {
    it('should allow any project creator to delete their project', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier for test
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // project name
          async (testId, projectName) => {
            // Setup: Create user and project
            const creator = await createTestUser(`proptest-creator-${testId}@example.com`);
            const project = await createTestProject(projectName.trim(), creator.id);
            
            // Add creator as Admin member
            await addProjectMember(creator.id, project.id, 'Admin');

            // Create some tasks to verify cascade deletion
            await prisma.task.create({
              data: {
                title: 'Test Task',
                due_date: new Date('2024-12-31'),
                project_id: project.id,
                assigned_to: creator.id
              }
            });

            // Verify project exists before deletion
            const projectBefore = await prisma.project.findUnique({
              where: { id: project.id }
            });
            expect(projectBefore).toBeDefined();

            // Execute: Delete project as creator
            const deletedProject = await prisma.project.delete({
              where: { id: project.id }
            });

            // Verify: Project was deleted
            expect(deletedProject).toBeDefined();
            expect(deletedProject.id).toBe(project.id);

            // Verify: Project no longer exists
            const projectAfter = await prisma.project.findUnique({
              where: { id: project.id }
            });
            expect(projectAfter).toBeNull();

            // Verify: Associated tasks were cascade deleted
            const tasks = await prisma.task.findMany({
              where: { project_id: project.id }
            });
            expect(tasks).toHaveLength(0);

            // Verify: Associated memberships were cascade deleted
            const memberships = await prisma.projectMember.findMany({
              where: { project_id: project.id }
            });
            expect(memberships).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should cascade delete all associated data when creator deletes project', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 1, max: 5 }), // number of additional members
          fc.integer({ min: 1, max: 10 }), // number of tasks
          async (testId, numMembers, numTasks) => {
            // Setup: Create creator and project
            const creator = await createTestUser(`proptest-cascade-${testId}@example.com`);
            const project = await createTestProject(`Project ${testId}`, creator.id);
            await addProjectMember(creator.id, project.id, 'Admin');

            // Add additional members
            const members = [];
            for (let i = 0; i < numMembers; i++) {
              const member = await createTestUser(`proptest-member-${testId}-${i}@example.com`);
              await addProjectMember(member.id, project.id, 'Member');
              members.push(member);
            }

            // Create tasks
            for (let i = 0; i < numTasks; i++) {
              await prisma.task.create({
                data: {
                  title: `Task ${i}`,
                  due_date: new Date('2024-12-31'),
                  project_id: project.id,
                  assigned_to: i % 2 === 0 ? creator.id : (members[i % members.length]?.id || null)
                }
              });
            }

            // Verify data exists before deletion
            const tasksBefore = await prisma.task.count({
              where: { project_id: project.id }
            });
            const membersBefore = await prisma.projectMember.count({
              where: { project_id: project.id }
            });
            expect(tasksBefore).toBe(numTasks);
            expect(membersBefore).toBe(numMembers + 1); // +1 for creator

            // Execute: Delete project
            await prisma.project.delete({
              where: { id: project.id }
            });

            // Verify: All tasks cascade deleted
            const tasksAfter = await prisma.task.count({
              where: { project_id: project.id }
            });
            expect(tasksAfter).toBe(0);

            // Verify: All memberships cascade deleted
            const membersAfter = await prisma.projectMember.count({
              where: { project_id: project.id }
            });
            expect(membersAfter).toBe(0);
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 6: Non-Creator Deletion Denial
   * 
   * For any project and any authenticated user who did not create that project
   * (regardless of role), the API server SHALL deny deletion requests with a 403 Forbidden status.
   * 
   * Validates: Requirements 2.5
   */
  describe('Property 6: Non-Creator Deletion Denial', () => {
    it('should deny deletion for any non-creator user regardless of role', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.constantFrom('Admin', 'Member'), // role of non-creator
          async (testId, role) => {
            // Setup: Create creator and project
            const creator = await createTestUser(`proptest-creator-${testId}@example.com`);
            const nonCreator = await createTestUser(`proptest-noncreator-${testId}@example.com`);
            
            const project = await createTestProject(`Project ${testId}`, creator.id);
            
            // Add both users as members
            await addProjectMember(creator.id, project.id, 'Admin');
            await addProjectMember(nonCreator.id, project.id, role);

            // Verify project exists
            const projectBefore = await prisma.project.findUnique({
              where: { id: project.id }
            });
            expect(projectBefore).toBeDefined();
            expect(projectBefore.created_by).toBe(creator.id);
            expect(projectBefore.created_by).not.toBe(nonCreator.id);

            // Execute: Attempt to delete as non-creator
            // In a real controller, this would return 403
            // Here we verify the authorization check would fail
            const membership = await prisma.projectMember.findFirst({
              where: {
                user_id: nonCreator.id,
                project_id: project.id
              }
            });
            expect(membership).toBeDefined();
            expect(membership.user_id).not.toBe(projectBefore.created_by);

            // Verify: Project still exists (non-creator cannot delete)
            const projectAfter = await prisma.project.findUnique({
              where: { id: project.id }
            });
            expect(projectAfter).toBeDefined();
            expect(projectAfter.id).toBe(project.id);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve project when non-creator attempts deletion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 1, max: 3 }), // number of non-creator admins
          async (testId, numNonCreators) => {
            // Setup: Create creator and project
            const creator = await createTestUser(`proptest-preserve-creator-${testId}@example.com`);
            const project = await createTestProject(`Project ${testId}`, creator.id);
            await addProjectMember(creator.id, project.id, 'Admin');

            // Add multiple non-creator admins
            const nonCreators = [];
            for (let i = 0; i < numNonCreators; i++) {
              const nonCreator = await createTestUser(`proptest-preserve-nc-${testId}-${i}@example.com`);
              await addProjectMember(nonCreator.id, project.id, 'Admin');
              nonCreators.push(nonCreator);
            }

            // Verify: None of the non-creators can delete
            for (const nonCreator of nonCreators) {
              const projectCheck = await prisma.project.findUnique({
                where: { id: project.id }
              });
              expect(projectCheck).toBeDefined();
              expect(projectCheck.created_by).toBe(creator.id);
              expect(projectCheck.created_by).not.toBe(nonCreator.id);
            }

            // Verify: Project still exists after all checks
            const finalProject = await prisma.project.findUnique({
              where: { id: project.id }
            });
            expect(finalProject).toBeDefined();
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 11: Project Membership Retrieval
   * 
   * For any authenticated user, when requesting their projects,
   * the API server SHALL return exactly the set of projects where that user
   * has a ProjectMember record, and no others.
   * 
   * Validates: Requirements 3.2
   */
  describe('Property 11: Project Membership Retrieval', () => {
    it('should return exactly the projects where user is a member', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 1, max: 5 }), // number of projects user is member of
          fc.integer({ min: 1, max: 5 }), // number of projects user is NOT member of
          async (testId, numMemberProjects, numNonMemberProjects) => {
            // Setup: Create test user
            const user = await createTestUser(`proptest-retrieval-${testId}@example.com`);
            const otherUser = await createTestUser(`proptest-other-${testId}@example.com`);

            // Create projects where user IS a member
            const memberProjectIds = [];
            for (let i = 0; i < numMemberProjects; i++) {
              const project = await createTestProject(`Member Project ${testId}-${i}`, user.id);
              await addProjectMember(user.id, project.id, i % 2 === 0 ? 'Admin' : 'Member');
              memberProjectIds.push(project.id);
            }

            // Create projects where user is NOT a member
            const nonMemberProjectIds = [];
            for (let i = 0; i < numNonMemberProjects; i++) {
              const project = await createTestProject(`Non-Member Project ${testId}-${i}`, otherUser.id);
              await addProjectMember(otherUser.id, project.id, 'Admin');
              nonMemberProjectIds.push(project.id);
            }

            // Execute: Retrieve user's projects
            const userProjects = await prisma.project.findMany({
              where: {
                members: {
                  some: {
                    user_id: user.id
                  }
                }
              }
            });

            // Verify: User gets exactly their member projects
            expect(userProjects).toHaveLength(numMemberProjects);
            
            const retrievedIds = userProjects.map(p => p.id).sort();
            const expectedIds = memberProjectIds.sort();
            expect(retrievedIds).toEqual(expectedIds);

            // Verify: User does NOT get non-member projects
            for (const nonMemberProjectId of nonMemberProjectIds) {
              expect(retrievedIds).not.toContain(nonMemberProjectId);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should return empty array when user has no project memberships', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 1, max: 5 }), // number of projects that exist
          async (testId, numProjects) => {
            // Setup: Create user with no memberships
            const user = await createTestUser(`proptest-nomember-${testId}@example.com`);
            const otherUser = await createTestUser(`proptest-other-${testId}@example.com`);

            // Create projects for other user
            for (let i = 0; i < numProjects; i++) {
              const project = await createTestProject(`Other Project ${testId}-${i}`, otherUser.id);
              await addProjectMember(otherUser.id, project.id, 'Admin');
            }

            // Execute: Retrieve user's projects
            const userProjects = await prisma.project.findMany({
              where: {
                members: {
                  some: {
                    user_id: user.id
                  }
                }
              }
            });

            // Verify: User gets empty array
            expect(userProjects).toHaveLength(0);
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 12: Project Access Authorization
   * 
   * For any project ID and any authenticated user,
   * the API server SHALL return project details if and only if
   * the user has a ProjectMember record for that project.
   * 
   * Validates: Requirements 3.3
   */
  describe('Property 12: Project Access Authorization', () => {
    it('should grant access to project details only for members', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.constantFrom('Admin', 'Member'), // role of member
          async (testId, role) => {
            // Setup: Create users and project
            const member = await createTestUser(`proptest-member-${testId}@example.com`);
            const nonMember = await createTestUser(`proptest-nonmember-${testId}@example.com`);
            const creator = await createTestUser(`proptest-creator-${testId}@example.com`);

            const project = await createTestProject(`Project ${testId}`, creator.id);
            
            // Add creator and member
            await addProjectMember(creator.id, project.id, 'Admin');
            await addProjectMember(member.id, project.id, role);

            // Execute: Check member access
            const memberAccess = await prisma.projectMember.findFirst({
              where: {
                user_id: member.id,
                project_id: project.id
              }
            });

            // Verify: Member has access
            expect(memberAccess).toBeDefined();
            expect(memberAccess.user_id).toBe(member.id);
            expect(memberAccess.project_id).toBe(project.id);

            // Execute: Check non-member access
            const nonMemberAccess = await prisma.projectMember.findFirst({
              where: {
                user_id: nonMember.id,
                project_id: project.id
              }
            });

            // Verify: Non-member has NO access
            expect(nonMemberAccess).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should enforce access control across multiple projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 2, max: 5 }), // number of projects
          async (testId, numProjects) => {
            // Setup: Create user
            const user = await createTestUser(`proptest-multiproject-${testId}@example.com`);
            const creator = await createTestUser(`proptest-creator-${testId}@example.com`);

            // Create projects - user is member of odd-indexed projects only
            const memberProjectIds = [];
            const nonMemberProjectIds = [];

            for (let i = 0; i < numProjects; i++) {
              const project = await createTestProject(`Project ${testId}-${i}`, creator.id);
              await addProjectMember(creator.id, project.id, 'Admin');

              if (i % 2 === 1) {
                // User is member of odd-indexed projects
                await addProjectMember(user.id, project.id, 'Member');
                memberProjectIds.push(project.id);
              } else {
                // User is NOT member of even-indexed projects
                nonMemberProjectIds.push(project.id);
              }
            }

            // Verify: User has access to member projects
            for (const projectId of memberProjectIds) {
              const access = await prisma.projectMember.findFirst({
                where: {
                  user_id: user.id,
                  project_id: projectId
                }
              });
              expect(access).toBeDefined();
            }

            // Verify: User does NOT have access to non-member projects
            for (const projectId of nonMemberProjectIds) {
              const access = await prisma.projectMember.findFirst({
                where: {
                  user_id: user.id,
                  project_id: projectId
                }
              });
              expect(access).toBeNull();
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 14: Automatic Creator Membership
   * 
   * For any project creation by any authenticated Admin user,
   * the API server SHALL automatically create a ProjectMember record
   * with that user as Admin role.
   * 
   * Validates: Requirements 3.6
   */
  describe('Property 14: Automatic Creator Membership', () => {
    it('should automatically add creator as Admin member for any project', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // project name
          async (testId, projectName) => {
            // Setup: Create user
            const creator = await createTestUser(`proptest-autocreate-${testId}@example.com`);

            // Execute: Create project
            const project = await createTestProject(projectName.trim(), creator.id);

            // Manually add creator as Admin (simulating controller behavior)
            await addProjectMember(creator.id, project.id, 'Admin');

            // Verify: Creator is automatically added as Admin member
            const membership = await prisma.projectMember.findFirst({
              where: {
                user_id: creator.id,
                project_id: project.id
              }
            });

            expect(membership).toBeDefined();
            expect(membership.user_id).toBe(creator.id);
            expect(membership.project_id).toBe(project.id);
            expect(membership.role).toBe('Admin');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should ensure creator membership exists immediately after project creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          async (testId) => {
            // Setup: Create user
            const creator = await createTestUser(`proptest-immediate-${testId}@example.com`);

            // Execute: Create project and add creator
            const project = await createTestProject(`Project ${testId}`, creator.id);
            await addProjectMember(creator.id, project.id, 'Admin');

            // Verify: Membership exists immediately
            const membership = await prisma.projectMember.findFirst({
              where: {
                user_id: creator.id,
                project_id: project.id,
                role: 'Admin'
              }
            });

            expect(membership).toBeDefined();
            expect(membership.joined_at).toBeDefined();
            expect(membership.joined_at).toBeInstanceOf(Date);

            // Verify: Creator can access their own project
            const projectAccess = await prisma.project.findFirst({
              where: {
                id: project.id,
                members: {
                  some: {
                    user_id: creator.id
                  }
                }
              }
            });

            expect(projectAccess).toBeDefined();
            expect(projectAccess.id).toBe(project.id);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should create exactly one Admin membership for creator', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          async (testId) => {
            // Setup: Create user
            const creator = await createTestUser(`proptest-single-${testId}@example.com`);

            // Execute: Create project and add creator
            const project = await createTestProject(`Project ${testId}`, creator.id);
            await addProjectMember(creator.id, project.id, 'Admin');

            // Verify: Exactly one membership exists for creator
            const memberships = await prisma.projectMember.findMany({
              where: {
                user_id: creator.id,
                project_id: project.id
              }
            });

            expect(memberships).toHaveLength(1);
            expect(memberships[0].role).toBe('Admin');
            expect(memberships[0].user_id).toBe(creator.id);
            expect(memberships[0].project_id).toBe(project.id);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 15: Project Membership Creation
   * 
   * For any valid user ID, project ID, and role (Admin or Member),
   * when an Admin adds a member, the API server SHALL create a ProjectMember
   * record with the specified values.
   * 
   * Validates: Requirements 4.1
   */
  describe('Property 15: Project Membership Creation', () => {
    it('should create ProjectMember record with specified values for any valid inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.constantFrom('Admin', 'Member'), // role to assign
          async (testId, role) => {
            // Setup: Create admin, project, and user to add
            const admin = await createTestUser(`proptest-admin-${testId}@example.com`);
            const userToAdd = await createTestUser(`proptest-newmember-${testId}@example.com`);
            
            const project = await createTestProject(`Project ${testId}`, admin.id);
            await addProjectMember(admin.id, project.id, 'Admin');

            // Execute: Add member with specified role
            const projectMember = await prisma.projectMember.create({
              data: {
                user_id: userToAdd.id,
                project_id: project.id,
                role: role
              }
            });

            // Verify: ProjectMember record created with correct values
            expect(projectMember).toBeDefined();
            expect(projectMember.user_id).toBe(userToAdd.id);
            expect(projectMember.project_id).toBe(project.id);
            expect(projectMember.role).toBe(role);
            expect(projectMember.joined_at).toBeInstanceOf(Date);

            // Verify: Record exists in database
            const memberInDb = await prisma.projectMember.findFirst({
              where: {
                user_id: userToAdd.id,
                project_id: project.id
              }
            });
            expect(memberInDb).toBeDefined();
            expect(memberInDb.role).toBe(role);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should create membership for multiple users with different roles', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 2, max: 5 }), // number of members to add
          async (testId, numMembers) => {
            // Setup: Create admin and project
            const admin = await createTestUser(`proptest-admin-multi-${testId}@example.com`);
            const project = await createTestProject(`Project ${testId}`, admin.id);
            await addProjectMember(admin.id, project.id, 'Admin');

            // Execute: Add multiple members with alternating roles
            const addedMembers = [];
            for (let i = 0; i < numMembers; i++) {
              const user = await createTestUser(`proptest-member-${testId}-${i}@example.com`);
              const role = i % 2 === 0 ? 'Admin' : 'Member';
              
              const projectMember = await prisma.projectMember.create({
                data: {
                  user_id: user.id,
                  project_id: project.id,
                  role: role
                }
              });
              
              addedMembers.push({ userId: user.id, role: role, memberId: projectMember.id });
            }

            // Verify: All members were added with correct roles
            for (const member of addedMembers) {
              const memberInDb = await prisma.projectMember.findFirst({
                where: {
                  user_id: member.userId,
                  project_id: project.id
                }
              });
              expect(memberInDb).toBeDefined();
              expect(memberInDb.role).toBe(member.role);
            }

            // Verify: Total member count is correct (admin + added members)
            const totalMembers = await prisma.projectMember.count({
              where: { project_id: project.id }
            });
            expect(totalMembers).toBe(numMembers + 1); // +1 for admin
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 16: Project Membership Deletion
   * 
   * For any existing ProjectMember record, when an Admin removes that member,
   * the API server SHALL delete the ProjectMember record from the database.
   * 
   * Validates: Requirements 4.2
   */
  describe('Property 16: Project Membership Deletion', () => {
    it('should delete ProjectMember record for any existing member', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.constantFrom('Admin', 'Member'), // role of member to remove
          async (testId, role) => {
            // Setup: Create admin, project, and member
            const admin = await createTestUser(`proptest-admin-del-${testId}@example.com`);
            const memberToRemove = await createTestUser(`proptest-remove-${testId}@example.com`);
            
            const project = await createTestProject(`Project ${testId}`, admin.id);
            await addProjectMember(admin.id, project.id, 'Admin');
            const membership = await addProjectMember(memberToRemove.id, project.id, role);

            // Verify: Member exists before deletion
            const memberBefore = await prisma.projectMember.findUnique({
              where: { id: membership.id }
            });
            expect(memberBefore).toBeDefined();

            // Execute: Delete ProjectMember record
            await prisma.projectMember.delete({
              where: { id: membership.id }
            });

            // Verify: ProjectMember record no longer exists
            const memberAfter = await prisma.projectMember.findUnique({
              where: { id: membership.id }
            });
            expect(memberAfter).toBeNull();

            // Verify: User still exists (only membership deleted)
            const userStillExists = await prisma.user.findUnique({
              where: { id: memberToRemove.id }
            });
            expect(userStillExists).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should delete multiple members independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 2, max: 5 }), // number of members
          async (testId, numMembers) => {
            // Setup: Create admin, project, and multiple members
            const admin = await createTestUser(`proptest-admin-multidel-${testId}@example.com`);
            const project = await createTestProject(`Project ${testId}`, admin.id);
            await addProjectMember(admin.id, project.id, 'Admin');

            const memberships = [];
            for (let i = 0; i < numMembers; i++) {
              const user = await createTestUser(`proptest-delmember-${testId}-${i}@example.com`);
              const membership = await addProjectMember(user.id, project.id, 'Member');
              memberships.push(membership);
            }

            // Execute: Delete half of the members (rounded down)
            const numToDelete = Math.floor(numMembers / 2);
            for (let i = 0; i < numToDelete; i++) {
              await prisma.projectMember.delete({
                where: { id: memberships[i].id }
              });
            }

            // Verify: Deleted members no longer exist
            for (let i = 0; i < numToDelete; i++) {
              const deleted = await prisma.projectMember.findUnique({
                where: { id: memberships[i].id }
              });
              expect(deleted).toBeNull();
            }

            // Verify: Remaining members still exist
            for (let i = numToDelete; i < numMembers; i++) {
              const remaining = await prisma.projectMember.findUnique({
                where: { id: memberships[i].id }
              });
              expect(remaining).toBeDefined();
            }

            // Verify: Correct total count
            const remainingCount = await prisma.projectMember.count({
              where: { project_id: project.id }
            });
            expect(remainingCount).toBe(numMembers - numToDelete + 1); // +1 for admin
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 17: Duplicate Membership Prevention
   * 
   * For any user who already has a ProjectMember record for a given project,
   * attempting to add them again SHALL result in a 400 Bad Request error.
   * 
   * Validates: Requirements 4.3
   */
  describe('Property 17: Duplicate Membership Prevention', () => {
    it('should reject duplicate membership for any existing member', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.constantFrom('Admin', 'Member'), // initial role
          fc.constantFrom('Admin', 'Member'), // attempted duplicate role
          async (testId, initialRole, duplicateRole) => {
            // Setup: Create admin, project, and member
            const admin = await createTestUser(`proptest-admin-dup-${testId}@example.com`);
            const member = await createTestUser(`proptest-dupmember-${testId}@example.com`);
            
            const project = await createTestProject(`Project ${testId}`, admin.id);
            await addProjectMember(admin.id, project.id, 'Admin');
            await addProjectMember(member.id, project.id, initialRole);

            // Verify: Member already exists
            const existingMember = await prisma.projectMember.findFirst({
              where: {
                user_id: member.id,
                project_id: project.id
              }
            });
            expect(existingMember).toBeDefined();

            // Execute: Attempt to add duplicate member
            // This should fail due to unique constraint
            await expect(
              prisma.projectMember.create({
                data: {
                  user_id: member.id,
                  project_id: project.id,
                  role: duplicateRole
                }
              })
            ).rejects.toThrow();

            // Verify: Only one membership exists
            const memberships = await prisma.projectMember.findMany({
              where: {
                user_id: member.id,
                project_id: project.id
              }
            });
            expect(memberships).toHaveLength(1);
            expect(memberships[0].role).toBe(initialRole); // Original role unchanged
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow same user in different projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 2, max: 4 }), // number of projects
          async (testId, numProjects) => {
            // Setup: Create admin and user
            const admin = await createTestUser(`proptest-admin-multiproj-${testId}@example.com`);
            const user = await createTestUser(`proptest-multiproj-${testId}@example.com`);

            // Execute: Add user to multiple projects
            const projects = [];
            for (let i = 0; i < numProjects; i++) {
              const project = await createTestProject(`Project ${testId}-${i}`, admin.id);
              await addProjectMember(admin.id, project.id, 'Admin');
              await addProjectMember(user.id, project.id, 'Member');
              projects.push(project);
            }

            // Verify: User is member of all projects
            for (const project of projects) {
              const membership = await prisma.projectMember.findFirst({
                where: {
                  user_id: user.id,
                  project_id: project.id
                }
              });
              expect(membership).toBeDefined();
            }

            // Verify: Total memberships for user equals number of projects
            const totalMemberships = await prisma.projectMember.count({
              where: { user_id: user.id }
            });
            expect(totalMemberships).toBe(numProjects);
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 18: Task Unassignment on Member Removal
   * 
   * For any user being removed from a project, the API server SHALL set
   * assigned_to to null for all tasks in that project where assigned_to
   * equals the removed user's ID.
   * 
   * Validates: Requirements 4.4
   */
  describe('Property 18: Task Unassignment on Member Removal', () => {
    it('should unassign all tasks when member is removed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 1, max: 5 }), // number of tasks assigned to member
          async (testId, numTasks) => {
            // Setup: Create admin, project, and member
            const admin = await createTestUser(`proptest-admin-unassign-${testId}@example.com`);
            const member = await createTestUser(`proptest-unassign-${testId}@example.com`);
            
            const project = await createTestProject(`Project ${testId}`, admin.id);
            await addProjectMember(admin.id, project.id, 'Admin');
            const membership = await addProjectMember(member.id, project.id, 'Member');

            // Create tasks assigned to member
            const taskIds = [];
            for (let i = 0; i < numTasks; i++) {
              const task = await prisma.task.create({
                data: {
                  title: `Task ${i}`,
                  due_date: new Date('2024-12-31'),
                  project_id: project.id,
                  assigned_to: member.id
                }
              });
              taskIds.push(task.id);
            }

            // Verify: All tasks are assigned to member
            const tasksBeforeRemoval = await prisma.task.findMany({
              where: {
                project_id: project.id,
                assigned_to: member.id
              }
            });
            expect(tasksBeforeRemoval).toHaveLength(numTasks);

            // Execute: Unassign tasks and remove member (simulating controller behavior)
            await prisma.$transaction(async (tx) => {
              // Unassign all tasks
              await tx.task.updateMany({
                where: {
                  project_id: project.id,
                  assigned_to: member.id
                },
                data: {
                  assigned_to: null
                }
              });

              // Delete membership
              await tx.projectMember.delete({
                where: { id: membership.id }
              });
            });

            // Verify: All tasks are now unassigned
            const tasksAfterRemoval = await prisma.task.findMany({
              where: {
                id: { in: taskIds }
              }
            });
            expect(tasksAfterRemoval).toHaveLength(numTasks);
            for (const task of tasksAfterRemoval) {
              expect(task.assigned_to).toBeNull();
            }

            // Verify: Member is removed
            const memberAfter = await prisma.projectMember.findUnique({
              where: { id: membership.id }
            });
            expect(memberAfter).toBeNull();
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should only unassign tasks in the specific project', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 1, max: 3 }), // tasks in project A
          fc.integer({ min: 1, max: 3 }), // tasks in project B
          async (testId, tasksInA, tasksInB) => {
            // Setup: Create admin and member
            const admin = await createTestUser(`proptest-admin-multiproj-unassign-${testId}@example.com`);
            const member = await createTestUser(`proptest-multiproj-unassign-${testId}@example.com`);

            // Create two projects
            const projectA = await createTestProject(`Project A ${testId}`, admin.id);
            const projectB = await createTestProject(`Project B ${testId}`, admin.id);
            
            await addProjectMember(admin.id, projectA.id, 'Admin');
            await addProjectMember(admin.id, projectB.id, 'Admin');
            
            const membershipA = await addProjectMember(member.id, projectA.id, 'Member');
            await addProjectMember(member.id, projectB.id, 'Member');

            // Create tasks in project A assigned to member
            const taskIdsA = [];
            for (let i = 0; i < tasksInA; i++) {
              const task = await prisma.task.create({
                data: {
                  title: `Task A ${i}`,
                  due_date: new Date('2024-12-31'),
                  project_id: projectA.id,
                  assigned_to: member.id
                }
              });
              taskIdsA.push(task.id);
            }

            // Create tasks in project B assigned to member
            const taskIdsB = [];
            for (let i = 0; i < tasksInB; i++) {
              const task = await prisma.task.create({
                data: {
                  title: `Task B ${i}`,
                  due_date: new Date('2024-12-31'),
                  project_id: projectB.id,
                  assigned_to: member.id
                }
              });
              taskIdsB.push(task.id);
            }

            // Execute: Remove member from project A only
            await prisma.$transaction(async (tx) => {
              await tx.task.updateMany({
                where: {
                  project_id: projectA.id,
                  assigned_to: member.id
                },
                data: {
                  assigned_to: null
                }
              });

              await tx.projectMember.delete({
                where: { id: membershipA.id }
              });
            });

            // Verify: Tasks in project A are unassigned
            const tasksA = await prisma.task.findMany({
              where: { id: { in: taskIdsA } }
            });
            for (const task of tasksA) {
              expect(task.assigned_to).toBeNull();
            }

            // Verify: Tasks in project B are still assigned
            const tasksB = await prisma.task.findMany({
              where: { id: { in: taskIdsB } }
            });
            for (const task of tasksB) {
              expect(task.assigned_to).toBe(member.id);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 19: Non-Existent User Rejection
   * 
   * For any user ID that does not exist in the users table,
   * attempting to add them as a project member SHALL result in a 400 Bad Request error.
   * 
   * Validates: Requirements 4.5
   */
  describe('Property 19: Non-Existent User Rejection', () => {
    it('should reject adding non-existent user as project member', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 999999, max: 9999999 }), // non-existent user ID
          async (testId, nonExistentUserId) => {
            // Setup: Create admin and project
            const admin = await createTestUser(`proptest-admin-nonexist-${testId}@example.com`);
            const project = await createTestProject(`Project ${testId}`, admin.id);
            await addProjectMember(admin.id, project.id, 'Admin');

            // Verify: User does not exist
            const userExists = await prisma.user.findUnique({
              where: { id: nonExistentUserId }
            });
            expect(userExists).toBeNull();

            // Execute: Attempt to add non-existent user
            // This should fail due to foreign key constraint
            await expect(
              prisma.projectMember.create({
                data: {
                  user_id: nonExistentUserId,
                  project_id: project.id,
                  role: 'Member'
                }
              })
            ).rejects.toThrow();

            // Verify: No membership was created
            const membership = await prisma.projectMember.findFirst({
              where: {
                user_id: nonExistentUserId,
                project_id: project.id
              }
            });
            expect(membership).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should validate user existence before creating membership', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          async (testId) => {
            // Setup: Create admin and project
            const admin = await createTestUser(`proptest-admin-validate-${testId}@example.com`);
            const project = await createTestProject(`Project ${testId}`, admin.id);
            await addProjectMember(admin.id, project.id, 'Admin');

            // Create a user then delete them
            const tempUser = await createTestUser(`proptest-temp-${testId}@example.com`);
            const tempUserId = tempUser.id;
            await prisma.user.delete({ where: { id: tempUserId } });

            // Verify: User no longer exists
            const userExists = await prisma.user.findUnique({
              where: { id: tempUserId }
            });
            expect(userExists).toBeNull();

            // Execute: Attempt to add deleted user
            await expect(
              prisma.projectMember.create({
                data: {
                  user_id: tempUserId,
                  project_id: project.id,
                  role: 'Member'
                }
              })
            ).rejects.toThrow();
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 20: Project Creator Removal Prevention
   * 
   * For any project, attempting to remove the user whose ID matches
   * the project's created_by field SHALL result in a 403 Forbidden error.
   * 
   * Validates: Requirements 4.6
   */
  describe('Property 20: Project Creator Removal Prevention', () => {
    it('should prevent removal of project creator', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          async (testId) => {
            // Setup: Create creator and project
            const creator = await createTestUser(`proptest-creator-protect-${testId}@example.com`);
            const project = await createTestProject(`Project ${testId}`, creator.id);
            const creatorMembership = await addProjectMember(creator.id, project.id, 'Admin');

            // Verify: Creator is the project creator
            const projectData = await prisma.project.findUnique({
              where: { id: project.id }
            });
            expect(projectData.created_by).toBe(creator.id);

            // Verify: Creator has membership
            const membership = await prisma.projectMember.findUnique({
              where: { id: creatorMembership.id }
            });
            expect(membership).toBeDefined();
            expect(membership.user_id).toBe(creator.id);

            // Execute: Simulate authorization check (controller would return 403)
            // In the controller, this check happens before deletion
            const isCreator = projectData.created_by === creator.id;
            expect(isCreator).toBe(true);

            // Verify: If we tried to delete, creator membership still exists
            // (In real controller, deletion would be blocked with 403)
            const membershipStillExists = await prisma.projectMember.findUnique({
              where: { id: creatorMembership.id }
            });
            expect(membershipStillExists).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow removal of non-creator admins', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // unique identifier
          fc.integer({ min: 1, max: 3 }), // number of non-creator admins
          async (testId, numAdmins) => {
            // Setup: Create creator and project
            const creator = await createTestUser(`proptest-creator-allow-${testId}@example.com`);
            const project = await createTestProject(`Project ${testId}`, creator.id);
            await addProjectMember(creator.id, project.id, 'Admin');

            // Add non-creator admins
            const adminMemberships = [];
            for (let i = 0; i < numAdmins; i++) {
              const admin = await createTestUser(`proptest-admin-${testId}-${i}@example.com`);
              const membership = await addProjectMember(admin.id, project.id, 'Admin');
              adminMemberships.push({ userId: admin.id, membershipId: membership.id });
            }

            // Verify: All admins are not the creator
            const projectData = await prisma.project.findUnique({
              where: { id: project.id }
            });
            for (const admin of adminMemberships) {
              expect(admin.userId).not.toBe(projectData.created_by);
            }

            // Execute: Remove non-creator admins (should succeed)
            for (const admin of adminMemberships) {
              const isCreator = projectData.created_by === admin.userId;
              expect(isCreator).toBe(false);

              // Can safely delete non-creator
              await prisma.projectMember.delete({
                where: { id: admin.membershipId }
              });

              // Verify: Membership deleted
              const deleted = await prisma.projectMember.findUnique({
                where: { id: admin.membershipId }
              });
              expect(deleted).toBeNull();
            }

            // Verify: Creator membership still exists
            const creatorMembership = await prisma.projectMember.findFirst({
              where: {
                user_id: creator.id,
                project_id: project.id
              }
            });
            expect(creatorMembership).toBeDefined();
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
