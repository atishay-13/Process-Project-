import api from './api';

/**
 * Project service for managing projects and project members
 * Validates: Requirements 17.4, 17.5
 */
export const projectService = {
  /**
   * Get all projects where the current user is a member
   * @returns {Promise<Array>} Array of project objects with member and task counts
   * @throws {Error} If request fails
   */
  async getProjects() {
    const response = await api.get('/api/projects');
    return response.data;
  },

  /**
   * Get a specific project by ID with members and tasks
   * @param {number} id - Project ID
   * @returns {Promise<Object>} Project object with members and tasks
   * @throws {Error} If project not found or user lacks access
   */
  async getProject(id) {
    const response = await api.get(`/api/projects/${id}`);
    return response.data;
  },

  /**
   * Create a new project (Admin only)
   * @param {string} name - Project name (required, non-empty)
   * @returns {Promise<Object>} Created project object
   * @throws {Error} If creation fails or user lacks permissions
   */
  async createProject(name) {
    const response = await api.post('/api/projects', { name });
    return response.data;
  },

  /**
   * Delete a project (Admin only, must be creator)
   * @param {number} id - Project ID
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails or user lacks permissions
   */
  async deleteProject(id) {
    await api.delete(`/api/projects/${id}`);
  },

  /**
   * Add a member to a project (Admin only)
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID to add
   * @param {string} role - Role to assign ('Admin' or 'Member')
   * @returns {Promise<Object>} Created project member object
   * @throws {Error} If addition fails or user lacks permissions
   */
  async addMember(projectId, userId, role) {
    const response = await api.post(`/api/projects/${projectId}/members`, {
      user_id: userId,
      role
    });
    return response.data;
  },

  /**
   * Remove a member from a project (Admin only)
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID to remove
   * @returns {Promise<void>}
   * @throws {Error} If removal fails or user lacks permissions
   */
  async removeMember(projectId, userId) {
    await api.delete(`/api/projects/${projectId}/members/${userId}`);
  }
};

export default projectService;
