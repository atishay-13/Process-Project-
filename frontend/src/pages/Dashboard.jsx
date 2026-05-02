import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Dashboard component
 * Displays task summary cards grouped by status with project filtering
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 14.1, 14.2, 14.3, 14.4
 */
function Dashboard() {
  const { logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch tasks and projects on component mount and when filter changes
   * Validates: Requirements 9.1, 9.4
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch projects for filter dropdown
        const projectsData = await projectService.getProjects();
        setProjects(projectsData);

        // Fetch tasks with optional project filter
        const filters = {};
        if (selectedProjectId) {
          filters.projectId = parseInt(selectedProjectId);
        }
        const tasksData = await taskService.getTasks(filters);
        setTasks(tasksData);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedProjectId]);

  /**
   * Group tasks by status
   * Validates: Requirements 9.1, 9.5
   */
  const groupTasksByStatus = () => {
    const grouped = {
      'To Do': [],
      'In Progress': [],
      'Done': []
    };

    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  };

  /**
   * Check if a task is overdue
   * Validates: Requirements 9.2, 9.3
   */
  const isOverdue = (dueDate) => {
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
   * Handle logout
   */
  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  const groupedTasks = groupTasksByStatus();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Validates: Requirements 14.1, 14.2, 14.3, 14.4 */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/projects"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-center"
              >
                Projects
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors w-full sm:w-auto"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Project Filter - Validates: Requirements 9.4 */}
        <div className="mb-6">
          <label htmlFor="project-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Project
          </label>
          <select
            id="project-filter"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Projects</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Task Summary Cards - Validates: Requirements 9.1, 9.5, 14.1, 14.2, 14.3, 14.4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* To Do Column */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">To Do</h2>
              <span className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-sm font-medium">
                {groupedTasks['To Do'].length}
              </span>
            </div>
            <div className="space-y-3">
              {groupedTasks['To Do'].length === 0 ? (
                <p className="text-gray-500 text-sm">No tasks</p>
              ) : (
                groupedTasks['To Do'].map(task => (
                  <TaskCard key={task.id} task={task} isOverdue={isOverdue} formatDate={formatDate} />
                ))
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">In Progress</h2>
              <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-sm font-medium">
                {groupedTasks['In Progress'].length}
              </span>
            </div>
            <div className="space-y-3">
              {groupedTasks['In Progress'].length === 0 ? (
                <p className="text-gray-500 text-sm">No tasks</p>
              ) : (
                groupedTasks['In Progress'].map(task => (
                  <TaskCard key={task.id} task={task} isOverdue={isOverdue} formatDate={formatDate} />
                ))
              )}
            </div>
          </div>

          {/* Done Column */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Done</h2>
              <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-medium">
                {groupedTasks['Done'].length}
              </span>
            </div>
            <div className="space-y-3">
              {groupedTasks['Done'].length === 0 ? (
                <p className="text-gray-500 text-sm">No tasks</p>
              ) : (
                groupedTasks['Done'].map(task => (
                  <TaskCard key={task.id} task={task} isOverdue={isOverdue} formatDate={formatDate} />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * TaskCard component
 * Displays individual task information with overdue highlighting
 * Validates: Requirements 9.2, 9.6
 */
function TaskCard({ task, isOverdue, formatDate }) {
  const overdue = isOverdue(task.due_date) && task.status !== 'Done';

  return (
    <div 
      className={`p-4 rounded-md border-2 transition-colors ${
        overdue 
          ? 'border-red-500 bg-red-50' 
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <h3 className="font-medium text-gray-900 mb-2">{task.title}</h3>
      {task.description && (
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex flex-col gap-1 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="font-medium">Due:</span>
          <span className={overdue ? 'text-red-600 font-semibold' : ''}>
            {formatDate(task.due_date)}
          </span>
          {overdue && (
            <span className="ml-1 px-2 py-0.5 bg-red-600 text-white rounded text-xs font-semibold">
              OVERDUE
            </span>
          )}
        </div>
        {task.assigned_to && task.assignee && (
          <div className="flex items-center gap-1">
            <span className="font-medium">Assigned to:</span>
            <span>{task.assignee.name}</span>
          </div>
        )}
        {task.project && (
          <div className="flex items-center gap-1">
            <span className="font-medium">Project:</span>
            <span>{task.project.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
