import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProjectList from './ProjectList';
import { projectService } from '../services/projectService';
import { AuthProvider } from '../contexts/AuthContext';

// Mock services
vi.mock('../services/projectService', () => ({
  projectService: {
    getProjects: vi.fn(),
    createProject: vi.fn(),
  },
}));

// Helper to render with router and auth context
const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('ProjectList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Component renders and displays projects
   * Validates: Requirements 3.2
   */
  it('should render and display all projects for current user', async () => {
    const mockProjects = [
      {
        id: 1,
        name: 'Project Alpha',
        role: 'Admin',
        memberCount: 5,
        taskCount: 10,
        created_at: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        name: 'Project Beta',
        role: 'Member',
        memberCount: 3,
        taskCount: 7,
        created_at: '2024-01-02T00:00:00.000Z',
      },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<ProjectList />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading projects...')).not.toBeInTheDocument();
    });

    // Check that both projects are displayed
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();

    // Check member and task counts
    expect(screen.getAllByText('5')[0]).toBeInTheDocument(); // Member count for Project Alpha
    expect(screen.getAllByText('10')[0]).toBeInTheDocument(); // Task count for Project Alpha
  });

  /**
   * Test: Shows member count and task count for each project
   * Validates: Requirements 3.2
   */
  it('should display member count and task count for each project', async () => {
    const mockProjects = [
      {
        id: 1,
        name: 'Test Project',
        role: 'Admin',
        memberCount: 8,
        taskCount: 15,
        created_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Verify counts are displayed
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Members:')).toBeInTheDocument();
    expect(screen.getByText('Tasks:')).toBeInTheDocument();
  });

  /**
   * Test: Create Project button visible to Admins only
   * Validates: Requirements 3.2
   */
  it('should show Create Project button only for Admin users', async () => {
    const mockProjectsWithAdmin = [
      {
        id: 1,
        name: 'Admin Project',
        role: 'Admin',
        memberCount: 5,
        taskCount: 10,
        created_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    projectService.getProjects.mockResolvedValue(mockProjectsWithAdmin);

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Admin Project')).toBeInTheDocument();
    });

    // Admin should see Create Project button
    expect(screen.getByText('Create Project')).toBeInTheDocument();
  });

  /**
   * Test: Create Project button hidden for non-Admin users
   * Validates: Requirements 3.2
   */
  it('should hide Create Project button for non-Admin users', async () => {
    const mockProjectsWithoutAdmin = [
      {
        id: 1,
        name: 'Member Project',
        role: 'Member',
        memberCount: 5,
        taskCount: 10,
        created_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    projectService.getProjects.mockResolvedValue(mockProjectsWithoutAdmin);

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Member Project')).toBeInTheDocument();
    });

    // Non-admin should not see Create Project button
    expect(screen.queryByText('Create Project')).not.toBeInTheDocument();
  });

  /**
   * Test: Links to project detail view
   * Validates: Requirements 3.2
   */
  it('should provide links to project detail view', async () => {
    const mockProjects = [
      {
        id: 1,
        name: 'Test Project',
        role: 'Admin',
        memberCount: 5,
        taskCount: 10,
        created_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Check that the link exists
    const projectLink = screen.getByText('View Details →').closest('a');
    expect(projectLink).toHaveAttribute('href', '/projects/1');
  });

  /**
   * Test: Displays loading state
   */
  it('should display loading state while fetching projects', () => {
    projectService.getProjects.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<ProjectList />);

    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
  });

  /**
   * Test: Displays error state
   */
  it('should display error message when fetching projects fails', async () => {
    // Suppress console.error for this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    projectService.getProjects.mockRejectedValue({
      response: { data: { message: 'Failed to fetch projects' } },
    });

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch projects')).toBeInTheDocument();
    });
    
    consoleErrorSpy.mockRestore();
  });

  /**
   * Test: Displays empty state when no projects
   */
  it('should display empty state when user has no projects', async () => {
    projectService.getProjects.mockResolvedValue([]);

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText(/No projects found/)).toBeInTheDocument();
    });
  });

  /**
   * Test: Create project form submission
   * Validates: Requirements 3.1, 3.5
   */
  it('should allow Admin to create a new project', async () => {
    const mockProjects = [
      {
        id: 1,
        name: 'Existing Project',
        role: 'Admin',
        memberCount: 5,
        taskCount: 10,
        created_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);
    projectService.createProject.mockResolvedValue({
      id: 2,
      name: 'New Project',
    });

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Existing Project')).toBeInTheDocument();
    });

    // Click Create Project button
    fireEvent.click(screen.getByText('Create Project'));

    // Form should appear
    expect(screen.getByText('Create New Project')).toBeInTheDocument();

    // Fill in project name
    const input = screen.getByPlaceholderText('Enter project name');
    fireEvent.change(input, { target: { value: 'New Project' } });

    // Submit form
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(projectService.createProject).toHaveBeenCalledWith('New Project');
    });
  });

  /**
   * Test: Create project validation
   * Validates: Requirements 3.5
   */
  it('should validate project name is not empty', async () => {
    const mockProjects = [
      {
        id: 1,
        name: 'Existing Project',
        role: 'Admin',
        memberCount: 5,
        taskCount: 10,
        created_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Existing Project')).toBeInTheDocument();
    });

    // Click Create Project button
    fireEvent.click(screen.getByText('Create Project'));

    // Submit form without entering a name
    fireEvent.click(screen.getByText('Create'));

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    // Should not call createProject
    expect(projectService.createProject).not.toHaveBeenCalled();
  });

  /**
   * Test: Role badge display
   */
  it('should display role badges for each project', async () => {
    const mockProjects = [
      {
        id: 1,
        name: 'Admin Project',
        role: 'Admin',
        memberCount: 5,
        taskCount: 10,
        created_at: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        name: 'Member Project',
        role: 'Member',
        memberCount: 3,
        taskCount: 7,
        created_at: '2024-01-02T00:00:00.000Z',
      },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Admin Project')).toBeInTheDocument();
    });

    // Check role badges
    const roleBadges = screen.getAllByText(/Admin|Member/);
    expect(roleBadges.length).toBeGreaterThanOrEqual(2);
  });
});
