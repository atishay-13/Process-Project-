import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProjectDetail component
 * Displays project information, members, and tasks
 * Validates: Requirements 3.3, 4.1, 4.2, 14.1, 14.2, 14.3, 14.4
 */
function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Member');
  const [memberError, setMemberError] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  /**
   * Check if current user is Admin in this project
   */
  const isAdmin = project?.members?.some(
    member => member.user_id === user?.id && member.role === 'Admin'
  );

  /**
   * Check if current user is the project creator
   */
  const isCreator = project?.created_by === user?.id;

  /**
   * Fetch project details on component mount
   * Validates: Requirements 3.3
   */
  useEffect(() => {
    fetchProject();
  }, [id]);

  /**
   * Fetch project details
   */
  const fetchProject = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectService.getProject(parseInt(id));
      setProject(data);
    } catch (err) {
      console.error('Error fetching project:', err);
      setError(err.response?.data?.message || 'Failed to load project');
    } finally {
      setLoading(false);
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
   * Handle add member form submission
   * Validates: Requirements 4.1
   */
  const handleAddMember = async (e) => {
    e.preventDefault();
    setMemberError('');

    // Validate email
    if (!newMemberEmail.trim()) {
      setMemberError('Email is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMemberEmail)) {
      setMemberError('Please enter a valid email address');
      return;
    }

    setIsAddingMember(true);

    try {
      // Note: In a real app, you'd need an endpoint to look up user by email
      // For now, this is a placeholder - the backend expects user_id
      // This would need to be implemented in the backend or handled differently
      setMemberError('Adding members by email is not yet implemented. Please use user ID.');
      
      // TODO: Implement user lookup by email in backend
      // const userId = await userService.getUserIdByEmail(newMemberEmail);
      // await projectService.addMember(parseInt(id), userId, newMemberRole);
      
      // Reset form and refresh project
      // setNewMemberEmail('');
      // setNewMemberRole('Member');
      // setShowAddMemberForm(false);
      // await fetchProject();
    } catch (err) {
      console.error('Error adding member:', err);
      setMemberError(err.response?.data?.message || 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  /**
   * Handle remove member
   * Validates: Requirements 4.2
   */
  const handleRemoveMember = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to remove ${userName} from this project?`)) {
      return;
    }

    try {
      await projectService.removeMember(parseInt(id), userId);
      await fetchProject();
    } catch (err) {
      console.error('Error removing member:', err);
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  /**
   * Handle delete project
   * Validates: Requirements 3.4
   */
  const handleDeleteProject = async () => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone and will delete all tasks.')) {
      return;
    }

    try {
      await projectService.deleteProject(parseInt(id));
      navigate('/projects');
    } catch (err) {
      console.error('Error deleting project:', err);
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  /**
   * Cancel add member form
   */
  const handleCancelAddMember = () => {
    setShowAddMemberForm(false);
    setNewMemberEmail('');
    setNewMemberRole('Member');
    setMemberError('');
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status) => {
    switch (status) {
      case 'To Do':
        return 'bg-gray-200 text-gray-800';
      case 'In Progress':
        return 'bg-blue-200 text-blue-800';
      case 'Done':
        return 'bg-green-200 text-green-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading project...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Project Details</h1>
              <Link
                to="/projects"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Back to Projects
              </Link>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Validates: Requirements 14.1, 14.2, 14.3, 14.4 */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{project.name}</h1>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Members Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Project Members</h2>
              {isAdmin && !showAddMemberForm && (
                <button
                  onClick={() => setShowAddMemberForm(true)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Member
                </button>
              )}
            </div>

            {/* Add Member Form */}
            {showAddMemberForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-md">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Add New Member</h3>
                
                {memberError && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-xs text-red-600">{memberError}</p>
                  </div>
                )}

                <form onSubmit={handleAddMember}>
                  <div className="mb-3">
                    <label htmlFor="member-email" className="block text-xs font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="member-email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="user@example.com"
                      disabled={isAddingMember}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="member-role" className="block text-xs font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      id="member-role"
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isAddingMember}
                    >
                      <option value="Member">Member</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isAddingMember}
                      className={`px-3 py-1 text-sm rounded-md text-white font-medium transition-colors ${
                        isAddingMember
                          ? 'bg-blue-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isAddingMember ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddMember}
                      disabled={isAddingMember}
                      className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Members List */}
            <div className="space-y-3">
              {project.members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        member.role === 'Admin' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {member.role}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{member.email}</p>
                    <p className="text-xs text-gray-500">Joined: {new Date(member.joined_at).toLocaleDateString()}</p>
                  </div>
                  {isAdmin && member.user_id !== project.created_by && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id, member.name)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Project Tasks Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Tasks</h2>
            
            {project.tasks.length === 0 ? (
              <p className="text-gray-500 text-sm">No tasks in this project yet.</p>
            ) : (
              <div className="space-y-3">
                {project.tasks.map(task => (
                  <div key={task.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>Due: {new Date(task.due_date).toLocaleDateString()}</p>
                      {task.assigned_to && (
                        <p>Assigned to: {project.members.find(m => m.user_id === task.assigned_to)?.name || 'Unknown'}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete Project Button (Creator only) */}
        {isCreator && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Danger Zone</h2>
            <p className="text-sm text-gray-600 mb-4">
              Deleting this project will permanently remove all tasks and member associations. This action cannot be undone.
            </p>
            <button
              onClick={handleDeleteProject}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Delete Project
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default ProjectDetail;
