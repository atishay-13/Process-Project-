import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProjectForm component
 * Form for creating new projects
 * Validates: Requirements 3.1, 3.5, 14.1, 14.2, 14.3, 14.4
 */
function ProjectForm() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [projectName, setProjectName] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  /**
   * Handle input field changes
   */
  const handleChange = (e) => {
    const { value } = e.target;
    setProjectName(value);
    
    // Clear field-specific error when user starts typing
    if (errors.projectName) {
      setErrors({});
    }
    
    // Clear API error when user modifies form
    if (apiError) {
      setApiError('');
    }
  };

  /**
   * Validate form fields
   * Validates: Requirements 3.5
   * @returns {boolean} True if form is valid
   */
  const validateForm = () => {
    const newErrors = {};

    // Project name validation
    if (!projectName.trim()) {
      newErrors.projectName = 'Project name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   * Validates: Requirements 3.1, 3.5
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Create project
      await projectService.createProject(projectName.trim());
      
      // Redirect to projects list on success
      navigate('/projects');
    } catch (error) {
      // Display error message
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to create project. Please try again.';
      setApiError(errorMessage);
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Validates: Requirements 14.1, 14.2, 14.3, 14.4 */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Create New Project</h1>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/projects"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-center"
              >
                Back to Projects
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
          <div className="bg-white rounded-lg shadow p-6 sm:p-8">
            {/* Form Instructions */}
            <div className="mb-6">
              <p className="text-gray-600">
                Create a new project to organize tasks and collaborate with your team. 
                You will be automatically added as an Admin member.
              </p>
            </div>

            {/* Project Form */}
            <form onSubmit={handleSubmit} noValidate>
              {/* API Error Message */}
              {apiError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{apiError}</p>
                </div>
              )}

              {/* Project Name Field */}
              <div className="mb-6">
                <label 
                  htmlFor="project-name" 
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="project-name"
                  name="project-name"
                  value={projectName}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.projectName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter project name"
                  disabled={isSubmitting}
                />
                {errors.projectName && (
                  <p className="mt-1 text-sm text-red-600">{errors.projectName}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Choose a descriptive name for your project
                </p>
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors ${
                    isSubmitting
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isSubmitting ? 'Creating Project...' : 'Create Project'}
                </button>
                <Link
                  to="/projects"
                  className="flex-1 py-2 px-4 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors text-center font-medium"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>

          {/* Additional Information */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>You will be automatically added as an Admin member</li>
              <li>You can add other team members to the project</li>
              <li>You can create and assign tasks within the project</li>
              <li>Only you (the creator) can delete the project</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ProjectForm;
