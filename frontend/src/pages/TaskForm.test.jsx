import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TaskForm from './TaskForm';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import { AuthProvider } from '../contexts/AuthContext';

// Mock services
vi.mock('../services/taskService', () => ({
  taskService: {
    createTask: vi.fn(),
  },
}));

vi.mock('../services/projectService', () => ({
  projectService: {
    getProjects: vi.fn(),
    getProject: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

describe('TaskForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Component renders with all required fields
   * Validates: Requirements 5.1
   */
  it('should render form with all required fields', async () => {
    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check for all form fields
    expect(screen.getByLabelText(/Task Title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Project/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Assignee/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Due Date/)).toBeInTheDocument();
  });

  /**
   * Test: Title field validation
   * Validates: Requirements 5.2
   */
  it('should validate that title is not empty', async () => {
    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Submit form without filling title
    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Task title is required')).toBeInTheDocument();
    });

    // Should not call createTask
    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  /**
   * Test: Due date field validation
   * Validates: Requirements 5.6
   */
  it('should validate that due date is provided', async () => {
    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Fill only title
    const titleInput = screen.getByLabelText(/Task Title/);
    fireEvent.change(titleInput, { target: { value: 'Test Task' } });

    // Submit form without due date
    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Due date is required')).toBeInTheDocument();
    });

    // Should not call createTask
    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  /**
   * Test: Project field validation
   * Validates: Requirements 5.1
   */
  it('should validate that project is selected', async () => {
    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Fill title and due date but not project
    const titleInput = screen.getByLabelText(/Task Title/);
    fireEvent.change(titleInput, { target: { value: 'Test Task' } });

    const dueDateInput = screen.getByLabelText(/Due Date/);
    fireEvent.change(dueDateInput, { target: { value: '2024-12-31' } });

    // Submit form
    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Project is required')).toBeInTheDocument();
    });

    // Should not call createTask
    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  /**
   * Test: Successful task creation
   * Validates: Requirements 5.1
   */
  it('should create task with valid data', async () => {
    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    const mockProjectDetail = {
      id: 1,
      name: 'Project Alpha',
      members: [
        { user_id: 1, name: 'John Doe', role: 'Admin' },
        { user_id: 2, name: 'Jane Smith', role: 'Member' },
      ],
    };

    projectService.getProjects.mockResolvedValue(mockProjects);
    projectService.getProject.mockResolvedValue(mockProjectDetail);
    taskService.createTask.mockResolvedValue({
      id: 1,
      title: 'Test Task',
      description: 'Test Description',
      due_date: '2024-12-31',
      project_id: 1,
      assigned_to: 1,
      status: 'To Do',
    });

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Fill form
    const titleInput = screen.getByLabelText(/Task Title/);
    fireEvent.change(titleInput, { target: { value: 'Test Task' } });

    const descriptionInput = screen.getByLabelText(/Description/);
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

    const projectSelect = screen.getByLabelText(/Project/);
    fireEvent.change(projectSelect, { target: { value: '1' } });

    // Wait for members to load
    await waitFor(() => {
      expect(projectService.getProject).toHaveBeenCalledWith('1');
    });

    const assigneeSelect = screen.getByLabelText(/Assignee/);
    fireEvent.change(assigneeSelect, { target: { value: '1' } });

    const dueDateInput = screen.getByLabelText(/Due Date/);
    fireEvent.change(dueDateInput, { target: { value: '2024-12-31' } });

    // Submit form
    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(taskService.createTask).toHaveBeenCalledWith({
        title: 'Test Task',
        description: 'Test Description',
        due_date: '2024-12-31',
        project_id: 1,
        assigned_to: 1,
      });
    });

    // Should navigate to tasks list
    expect(mockNavigate).toHaveBeenCalledWith('/tasks');
  });

  /**
   * Test: Task creation without assignee
   * Validates: Requirements 5.1
   */
  it('should create task without assignee when none selected', async () => {
    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    const mockProjectDetail = {
      id: 1,
      name: 'Project Alpha',
      members: [
        { user_id: 1, name: 'John Doe', role: 'Admin' },
      ],
    };

    projectService.getProjects.mockResolvedValue(mockProjects);
    projectService.getProject.mockResolvedValue(mockProjectDetail);
    taskService.createTask.mockResolvedValue({
      id: 1,
      title: 'Test Task',
      due_date: '2024-12-31',
      project_id: 1,
      status: 'To Do',
    });

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Fill form without assignee
    const titleInput = screen.getByLabelText(/Task Title/);
    fireEvent.change(titleInput, { target: { value: 'Test Task' } });

    const projectSelect = screen.getByLabelText(/Project/);
    fireEvent.change(projectSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(projectService.getProject).toHaveBeenCalledWith('1');
    });

    const dueDateInput = screen.getByLabelText(/Due Date/);
    fireEvent.change(dueDateInput, { target: { value: '2024-12-31' } });

    // Submit form
    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(taskService.createTask).toHaveBeenCalledWith({
        title: 'Test Task',
        description: undefined,
        due_date: '2024-12-31',
        project_id: 1,
      });
    });
  });

  /**
   * Test: Assignee dropdown loads project members
   * Validates: Requirements 5.1
   */
  it('should load project members when project is selected', async () => {
    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    const mockProjectDetail = {
      id: 1,
      name: 'Project Alpha',
      members: [
        { user_id: 1, name: 'John Doe', role: 'Admin' },
        { user_id: 2, name: 'Jane Smith', role: 'Member' },
      ],
    };

    projectService.getProjects.mockResolvedValue(mockProjects);
    projectService.getProject.mockResolvedValue(mockProjectDetail);

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Select project
    const projectSelect = screen.getByLabelText(/Project/);
    fireEvent.change(projectSelect, { target: { value: '1' } });

    // Wait for members to load
    await waitFor(() => {
      expect(projectService.getProject).toHaveBeenCalledWith('1');
    });

    // Check that members appear in assignee dropdown
    const assigneeSelect = screen.getByLabelText(/Assignee/);
    expect(assigneeSelect).toBeInTheDocument();
    
    // Check options (including "Unassigned")
    const options = assigneeSelect.querySelectorAll('option');
    expect(options.length).toBe(3); // Unassigned + 2 members
  });

  /**
   * Test: Cancel button functionality
   */
  it('should navigate to tasks list when cancel is clicked', async () => {
    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Click cancel button
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Should navigate to tasks list
    expect(mockNavigate).toHaveBeenCalledWith('/tasks');
  });

  /**
   * Test: Error message display
   */
  it('should display error message when task creation fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);
    taskService.createTask.mockRejectedValue({
      response: { data: { message: 'Failed to create task' } },
    });

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Fill and submit form
    const titleInput = screen.getByLabelText(/Task Title/);
    fireEvent.change(titleInput, { target: { value: 'Test Task' } });

    const projectSelect = screen.getByLabelText(/Project/);
    fireEvent.change(projectSelect, { target: { value: '1' } });

    const dueDateInput = screen.getByLabelText(/Due Date/);
    fireEvent.change(dueDateInput, { target: { value: '2024-12-31' } });

    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    // Should display error message
    await waitFor(() => {
      expect(screen.getByText('Failed to create task')).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  /**
   * Test: Date picker has minimum date
   * Validates: Requirements 5.6
   */
  it('should set minimum date to today for date picker', async () => {
    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const dueDateInput = screen.getByLabelText(/Due Date/);
    const today = new Date().toISOString().split('T')[0];
    
    expect(dueDateInput).toHaveAttribute('min', today);
  });

  /**
   * Test: Required field indicators
   */
  it('should display required field indicators', async () => {
    const mockProjects = [
      { id: 1, name: 'Project Alpha', role: 'Admin' },
    ];

    projectService.getProjects.mockResolvedValue(mockProjects);

    renderWithProviders(<TaskForm />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check for asterisks indicating required fields
    const requiredIndicators = screen.getAllByText('*');
    expect(requiredIndicators.length).toBeGreaterThan(0);
  });
});
