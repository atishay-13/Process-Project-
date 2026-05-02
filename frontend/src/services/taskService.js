import api from './api';

/**
 * Task service for managing tasks
 * Validates: Requirements 17.4, 17.5
 */
export const taskService = {
  /**
   * Get tasks with optional filters
   * @param {Object} filters - Optional filter parameters
   * @param {number} filters.projectId - Filter by project ID
   * @param {string} filters.status - Filter by status ('To Do', 'In Progress', 'Done')
   * @param {boolean} filters.assignedToMe - Filter tasks assigned to current user
   * @returns {Promise<Array>} Array of task objects with assignee and project details
   * @throws {Error} If request fails
   */
  async getTasks(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.projectId) {
      params.append('project_id', filters.projectId);
    }
    if (filters.status) {
      params.append('status', filters.status);
    }
    if (filters.assignedToMe) {
      params.append('assigned_to_me', 'true');
    }
    
    const queryString = params.toString();
    const url = queryString ? `/api/tasks?${queryString}` : '/api/tasks';
    
    const response = await api.get(url);
    return response.data;
  },

  /**
   * Create a new task (Admin only)
   * @param {Object} taskData - Task data
   * @param {string} taskData.title - Task title (required, non-empty)
   * @param {string} taskData.description - Task description (optional)
   * @param {string} taskData.due_date - Due date in ISO 8601 format (required)
   * @param {number} taskData.assigned_to - User ID to assign (optional)
   * @param {number} taskData.project_id - Project ID (required)
   * @returns {Promise<Object>} Created task object
   * @throws {Error} If creation fails or user lacks permissions
   */
  async createTask(taskData) {
    const response = await api.post('/api/tasks', taskData);
    return response.data;
  },

  /**
   * Update task status (Admin or assigned member only)
   * @param {number} taskId - Task ID
   * @param {string} status - New status ('To Do', 'In Progress', 'Done')
   * @returns {Promise<Object>} Updated task object
   * @throws {Error} If update fails or user lacks permissions
   */
  async updateTaskStatus(taskId, status) {
    const response = await api.patch(`/api/tasks/${taskId}/status`, { status });
    return response.data;
  },

  /**
   * Delete a task (Admin only)
   * @param {number} taskId - Task ID
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails or user lacks permissions
   */
  async deleteTask(taskId) {
    await api.delete(`/api/tasks/${taskId}`);
  }
};

export default taskService;
