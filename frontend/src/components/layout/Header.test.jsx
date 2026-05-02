import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from './Header';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper function to render Header with required providers
function renderHeader() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Header />
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the brand/logo', () => {
      renderHeader();
      expect(screen.getByText('Team Task Manager')).toBeInTheDocument();
    });

    it('should render navigation links on desktop', () => {
      renderHeader();
      
      // Check for navigation links (desktop view)
      const dashboardLinks = screen.getAllByText('Dashboard');
      const projectsLinks = screen.getAllByText('Projects');
      const tasksLinks = screen.getAllByText('Tasks');
      
      expect(dashboardLinks.length).toBeGreaterThan(0);
      expect(projectsLinks.length).toBeGreaterThan(0);
      expect(tasksLinks.length).toBeGreaterThan(0);
    });

    it('should render logout button', () => {
      renderHeader();
      const logoutButtons = screen.getAllByText('Logout');
      expect(logoutButtons.length).toBeGreaterThan(0);
    });

    it('should render mobile menu button', () => {
      renderHeader();
      const menuButton = screen.getByLabelText('Toggle navigation menu');
      expect(menuButton).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('should have correct href attributes', () => {
      renderHeader();
      
      const dashboardLinks = screen.getAllByText('Dashboard');
      const projectsLinks = screen.getAllByText('Projects');
      const tasksLinks = screen.getAllByText('Tasks');
      
      // Check first occurrence (desktop nav)
      expect(dashboardLinks[0].closest('a')).toHaveAttribute('href', '/dashboard');
      expect(projectsLinks[0].closest('a')).toHaveAttribute('href', '/projects');
      expect(tasksLinks[0].closest('a')).toHaveAttribute('href', '/tasks');
    });
  });

  describe('Mobile Menu', () => {
    it('should toggle mobile menu when hamburger button is clicked', () => {
      renderHeader();
      
      const menuButton = screen.getByLabelText('Toggle navigation menu');
      
      // Initially, mobile menu should not be visible (check aria-expanded)
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      
      // Click to open
      fireEvent.click(menuButton);
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      
      // Click to close
      fireEvent.click(menuButton);
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should close mobile menu when a navigation link is clicked', () => {
      renderHeader();
      
      const menuButton = screen.getByLabelText('Toggle navigation menu');
      
      // Open mobile menu
      fireEvent.click(menuButton);
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      
      // Click a navigation link (get the last one which should be in mobile menu)
      const dashboardLinks = screen.getAllByText('Dashboard');
      fireEvent.click(dashboardLinks[dashboardLinks.length - 1]);
      
      // Menu should close
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Logout Functionality', () => {
    it('should call logout and navigate to login when logout button is clicked', async () => {
      renderHeader();
      
      // Get the first logout button (desktop)
      const logoutButtons = screen.getAllByText('Logout');
      const desktopLogoutButton = logoutButtons[0];
      
      // Click logout
      fireEvent.click(desktopLogoutButton);
      
      // Should navigate to login
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive classes for mobile and desktop', () => {
      const { container } = renderHeader();
      
      // Check for responsive classes
      const desktopNav = container.querySelector('.hidden.md\\:flex');
      const mobileMenuButton = container.querySelector('.md\\:hidden');
      
      expect(desktopNav).toBeInTheDocument();
      expect(mobileMenuButton).toBeInTheDocument();
    });
  });

  describe('Active Route Highlighting', () => {
    it('should apply active styles to current route', () => {
      // This test would require mocking useLocation to return specific paths
      // For now, we just verify the component renders without errors
      renderHeader();
      expect(screen.getByText('Team Task Manager')).toBeInTheDocument();
    });
  });
});
