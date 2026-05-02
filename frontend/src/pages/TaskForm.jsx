import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';

/**
 * TaskForm component
 * Form for creating new tasks with validation
 * Validates: Requirements 5.1, 5.2, 5.6
 */
function TaskForm() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    assigned_to: '',
    project_id: ''
  });
  
  // UI state
  const [projects, setProjects] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadingProjects, setLoadingProjects] = useState(true);

  /**
   * Fetch projects on component mount
   */
  useEffect(() => {
    fetchProjects();
  }, []);

  /**
   * Fetch project members when project is selected
   */
  useEffect(() => {
    if (formData.project_id) {
      fetchProjectMembers(formData.project_id);
    } else {
      setProjectMembers([]);
      setFormData(prev => ({ ...prev, assigned_to: '' }));
    }
  }, [formData.project_id]);

  /**
   * Fetch all projects for dropdown
   */
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects. Please refresh the page.');
    } finally {
      setLoadingProjects(false);
    }
  };

  /**
   * Fetch members of selected project
   */
  const fetchProjectMembers = async (projectId) => {
    try {
      const project = await projectService.getProject(projectId);
      setProjectMembers(project.members || []);
    } catch (err) {
      console.error('Error fetching project members:', err);
      setProjectMembers([]);
    }
  };

  /**
   * Handle input changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  /**
   * Validate form fields
   * Validates: Requirements 5.2, 5.6
   */
  const validateForm = () => {
    const errors = {};

    // Validate title (required, non-empty)
    if (!formData.title.trim()) {
      errors.title = 'Task title is required';
    }

    // Validate due date (required, valid date)
    if (!formData.due_date) {
      errors.due_date = 'Due date is required';
    } else {
      // Check if it's a valid date
      const date = new Date(formData.due_date);
      if (isNaN(date.getTime())) {
        errors.due_date = 'Invalid date format';
      }
    }

    // Validate project (required)
    if (!formData.project_id) {
      errors.project_id = 'Project is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission
   * Validates: Requirements 5.1, 5.2, 5.6
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Prepare task data
      const taskData = {
        title: formData.title.trim(),
        due_date: formData.due_date,
        project_id: parseInt(formData.project_id)
      };

      // Add description if provided
      if (formData.description.trim()) {
        taskData.description = formData.description.trim();
      }

      // Add assigned_to if selected
      if (formData.assigned_to) {
        taskData.assigned_to = parseInt(formData.assigned_to);
      }

      // Create task
      await taskService.createTask(taskData);

      // Navigate to tasks list on success
      navigate('/tasks');
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err.response?.data?.message || 'Failed to create task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    navigate('/tasks');
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  /**
   * Get minimum date for date picker (today)
   */
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (loadingProjects) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Validates: Requirements 14.1, 14.2, 14.3, 14.4 */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Create New Task</h1>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/dashboard"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-center"
              >
                Dashboard
              </Link>
              <Link
                to="/projects"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-center"
              >
                Projects
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Form Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* Title Field - Validates: Requirements 5.1, 5.2 */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.title ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter task title"
                  disabled={loading}
                />
                {fieldErrors.title && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.title}</p>
                )}
              </div>

              {/* Description Field - Validates: Requirements 5.1 */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter task description (optional)"
                  disabled={loading}
                />
              </div>

              {/* Project Field - Validates: Requirements 5.1 */}
              <div>
                <label htmlFor="project_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Project <span className="text-red-500">*</span>
                </label>
                <select
                  id="project_id"
                  name="project_id"
                  value={formData.project_id}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.project_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loading}
                >
                  <option value="">Select a project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.project_id && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.project_id}</p>
                )}
              </div>

              {/* Assignee Field - Validates: Requirements 5.1 */}
              <div>
                <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700 mb-1">
                  Assignee
                </label>
                <select
                  id="assigned_to"
                  name="assigned_to"
                  value={formData.assigned_to}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading || !formData.project_id}
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map(member => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name} ({member.role})
                    </option>
                  ))}
                </select>
                {!formData.project_id && (
                  <p className="mt-1 text-sm text-gray-500">Select a project first to see available assignees</p>
                )}
              </div>

              {/* Due Date Field - Validates: Requirements 5.1, 5.6 */}
              <div>
                <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="due_date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                  min={getMinDate()}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.due_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loading}
                />
                {fieldErrors.due_date && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.due_date}</p>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 px-6 py-2 rounded-md text-white font-medium transition-colors ${
                    loading
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* Help Text */}
          <div className="mt-4 text-sm text-gray-600">
            <p><span className="text-red-500">*</span> Required fields</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default TaskForm;
