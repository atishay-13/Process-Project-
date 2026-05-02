import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProjectForm from './ProjectForm';
import { projectService } from '../services/projectService';
import { AuthProvider } from '../contexts/AuthContext';

// Mock services
vi.mock('../services/projectService', () => ({
  projectService: {
    createProject: vi.fn(),
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

describe('ProjectForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Component renders with form fields
   * Validates: Requirements 3.1
   */
  it('should render form with project name field', () => {
    renderWithProviders(<ProjectForm />);

    expect(screen.getByText('Create New Project')).toBeInTheDocument();
    expect(screen.getByLabelText(/Project Name/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter project name')).toBeInTheDocument();
    expect(screen.getByText('Create Project')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  /**
   * Test: Form submission with valid data
   * Validates: Requirements 3.1
   */
  it('should submit form with valid project name', async () => {
    projectService.createProject.mockResolvedValue({
      id: 1,
      name: 'New Project',
    });

    renderWithProviders(<ProjectForm />);

    // Fill in project name
    const input = screen.getByPlaceholderText('Enter project name');
    fireEvent.change(input, { target: { value: 'New Project' } });

    // Submit form
    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    // Wait for submission
    await waitFor(() => {
      expect(projectService.createProject).toHaveBeenCalledWith('New Project');
    });

    // Should navigate to projects list
    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });

  /**
   * Test: Validates project name is not empty
   * Validates: Requirements 3.5
   */
  it('should validate that project name is not empty', async () => {
    renderWithProviders(<ProjectForm />);

    // Submit form without entering a name
    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    // Should not call createProject
    expect(projectService.createProject).not.toHaveBeenCalled();
  });

  /**
   * Test: Validates whitespace-only project name
   * Validates: Requirements 3.5
   */
  it('should validate that project name is not just whitespace', async () => {
    renderWithProviders(<ProjectForm />);

    // Fill in project name with only spaces
    const input = screen.getByPlaceholderText('Enter project name');
    fireEvent.change(input, { target: { value: '   ' } });

    // Submit form
    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    // Should not call createProject
    expect(projectService.createProject).not.toHaveBeenCalled();
  });

  /**
   * Test: Displays API error messages
   * Validates: Requirements 3.5
   */
  it('should display error message when project creation fails', async () => {
    projectService.createProject.mockRejectedValue({
      response: { data: { message: 'Project name already exists' } },
    });

    renderWithProviders(<ProjectForm />);

    // Fill in project name
    const input = screen.getByPlaceholderText('Enter project name');
    fireEvent.change(input, { target: { value: 'Duplicate Project' } });

    // Submit form
    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    // Should display error message
    await waitFor(() => {
      expect(screen.getByText('Project name already exists')).toBeInTheDocument();
    });

    // Should not navigate
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  /**
   * Test: Clears validation error when user starts typing
   */
  it('should clear validation error when user starts typing', async () => {
    renderWithProviders(<ProjectForm />);

    // Submit form without entering a name
    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    // Start typing
    const input = screen.getByPlaceholderText('Enter project name');
    fireEvent.change(input, { target: { value: 'N' } });

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Project name is required')).not.toBeInTheDocument();
    });
  });

  /**
   * Test: Clears API error when user modifies form
   */
  it('should clear API error when user modifies form', async () => {
    projectService.createProject.mockRejectedValue({
      response: { data: { message: 'Server error' } },
    });

    renderWithProviders(<ProjectForm />);

    // Fill in and submit
    const input = screen.getByPlaceholderText('Enter project name');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Create Project'));

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });

    // Modify input
    fireEvent.change(input, { target: { value: 'Test2' } });

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Server error')).not.toBeInTheDocument();
    });
  });

  /**
   * Test: Disables form during submission
   */
  it('should disable form fields during submission', async () => {
    projectService.createProject.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<ProjectForm />);

    // Fill in project name
    const input = screen.getByPlaceholderText('Enter project name');
    fireEvent.change(input, { target: { value: 'Test Project' } });

    // Submit form
    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    // Wait for submission to start
    await waitFor(() => {
      expect(screen.getByText('Creating Project...')).toBeInTheDocument();
    });

    // Input should be disabled
    expect(input).toBeDisabled();
  });

  /**
   * Test: Trims whitespace from project name
   * Validates: Requirements 3.1
   */
  it('should trim whitespace from project name before submission', async () => {
    projectService.createProject.mockResolvedValue({
      id: 1,
      name: 'Trimmed Project',
    });

    renderWithProviders(<ProjectForm />);

    // Fill in project name with leading/trailing spaces
    const input = screen.getByPlaceholderText('Enter project name');
    fireEvent.change(input, { target: { value: '  Trimmed Project  ' } });

    // Submit form
    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    // Should call with trimmed name
    await waitFor(() => {
      expect(projectService.createProject).toHaveBeenCalledWith('Trimmed Project');
    });
  });

  /**
   * Test: Cancel button navigates back
   */
  it('should navigate back to projects list when cancel is clicked', () => {
    renderWithProviders(<ProjectForm />);

    const cancelLink = screen.getByText('Cancel');
    expect(cancelLink).toHaveAttribute('href', '/projects');
  });

  /**
   * Test: Displays informational content
   */
  it('should display helpful information about project creation', () => {
    renderWithProviders(<ProjectForm />);

    expect(screen.getByText(/Create a new project to organize tasks/)).toBeInTheDocument();
    expect(screen.getByText(/What happens next?/)).toBeInTheDocument();
    // Use getAllByText since this text appears in multiple places
    const adminMemberTexts = screen.getAllByText(/You will be automatically added as an Admin member/);
    expect(adminMemberTexts.length).toBeGreaterThan(0);
  });

  /**
   * Test: Shows required field indicator
   */
  it('should indicate that project name is required', () => {
    renderWithProviders(<ProjectForm />);

    const requiredIndicator = screen.getByText('*');
    expect(requiredIndicator).toBeInTheDocument();
  });
});
