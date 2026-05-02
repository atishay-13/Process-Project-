import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';

/**
 * TaskList component
 * Displays tasks in responsive table/card format with filtering
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 9.6
 */
function TaskList() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showAssignedToMe, setShowAssignedToMe] = useState(false);
  
  // Status update state
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  /**
   * Fetch projects on component mount
   */
  useEffect(() => {
    fetchProjects();
  }, []);

  /**
   * Fetch tasks when filters change
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4
   */
  useEffect(() => {
    fetchTasks();
  }, [selectedProjectId, selectedStatus, showAssignedToMe]);

  /**
   * Fetch all projects for filter dropdown
   */
  const fetchProjects = async () => {
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      // Non-critical error, don't block task loading
    }
  };

  /**
   * Fetch tasks with current filters
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4
   */
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {};
      if (selectedProjectId) {
        filters.projectId = parseInt(selectedProjectId);
      }
      if (selectedStatus) {
        filters.status = selectedStatus;
      }
      if (showAssignedToMe) {
        filters.assignedToMe = true;
      }

      const data = await taskService.getTasks(filters);
      setTasks(data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.response?.data?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle status update
   * Validates: Requirements 6.1, 6.3, 6.4
   */
  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      setUpdatingTaskId(taskId);
      await taskService.updateTaskStatus(taskId, newStatus);
      
      // Update task in local state
      setTasks(tasks.map(task => 
        task.id === taskId 
          ? { ...task, status: newStatus, updated_at: new Date().toISOString() }
          : task
      ));
    } catch (err) {
      console.error('Error updating task status:', err);
      alert(err.response?.data?.message || 'Failed to update task status');
    } finally {
      setUpdatingTaskId(null);
    }
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
   * Check if a task is overdue
   * Validates: Requirements 9.2, 9.3
   */
  const isOverdue = (dueDate, status) => {
    if (status === 'Done') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setSelectedProjectId('');
    setSelectedStatus('');
    setShowAssignedToMe(false);
  };

  /**
   * Check if user can update task status
   * Admin or assigned member can update
   */
  const canUpdateStatus = (task) => {
    // This is a simplified check - in a real app, we'd check the user's role
    // For now, we'll allow updates if the task is assigned to the user or if they're an admin
    return true; // The backend will enforce the actual authorization
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Validates: Requirements 14.1, 14.2, 14.3, 14.4 */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tasks</h1>
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
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Filters Section - Validates: Requirements 7.2, 7.3, 7.4 */}
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Filter Tasks</h2>
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear Filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Project Filter */}
            <div>
              <label htmlFor="project-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Project
              </label>
              <select
                id="project-filter"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status-filter"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
            </div>

            {/* Assigned to Me Filter */}
            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAssignedToMe}
                  onChange={(e) => setShowAssignedToMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Assigned to Me
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Tasks Display - Validates: Requirements 7.1, 7.5, 9.6, 14.1, 14.2, 14.3, 14.4 */}
        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No tasks found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View - Hidden on mobile */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assignee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.map(task => {
                    const overdue = isOverdue(task.due_date, task.status);
                    return (
                      <tr 
                        key={task.id}
                        className={overdue ? 'bg-red-50' : 'hover:bg-gray-50'}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="text-sm font-medium text-gray-900">
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="text-sm text-gray-500 line-clamp-2">
                                {task.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {task.project?.name || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {task.assignee?.name || 'Unassigned'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm ${overdue ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                            {formatDate(task.due_date)}
                            {overdue && (
                              <span className="ml-2 px-2 py-0.5 bg-red-600 text-white rounded text-xs font-semibold">
                                OVERDUE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {canUpdateStatus(task) ? (
                            <select
                              value={task.status}
                              onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                              disabled={updatingTaskId === task.id}
                              className={`text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                updatingTaskId === task.id ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              <option value="To Do">To Do</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Done">Done</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              task.status === 'Done' 
                                ? 'bg-green-100 text-green-800'
                                : task.status === 'In Progress'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {task.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View - Visible on mobile only */}
            <div className="md:hidden space-y-4">
              {tasks.map(task => {
                const overdue = isOverdue(task.due_date, task.status);
                return (
                  <div 
                    key={task.id}
                    className={`bg-white rounded-lg shadow p-4 border-2 ${
                      overdue ? 'border-red-500 bg-red-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 line-clamp-3">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Project:</span>
                        <span className="text-gray-900">{task.project?.name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Assignee:</span>
                        <span className="text-gray-900">{task.assignee?.name || 'Unassigned'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Due Date:</span>
                        <span className={overdue ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                          {formatDate(task.due_date)}
                          {overdue && (
                            <span className="ml-2 px-2 py-0.5 bg-red-600 text-white rounded text-xs font-semibold">
                              OVERDUE
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="font-medium text-gray-700">Status:</span>
                        {canUpdateStatus(task) ? (
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                            disabled={updatingTaskId === task.id}
                            className={`text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              updatingTaskId === task.id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            <option value="To Do">To Do</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Done">Done</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            task.status === 'Done' 
                              ? 'bg-green-100 text-green-800'
                              : task.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {task.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default TaskList;
