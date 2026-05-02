import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/authService';

/**
 * Authentication Context
 * Manages global authentication state and provides auth functions
 * Validates: Requirements 13.1, 13.6
 */
const AuthContext = createContext(null);

/**
 * AuthProvider component
 * Wraps the application to provide authentication state and functions
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Check for existing token on mount
   * If token exists, assume user is authenticated
   */
  useEffect(() => {
    const checkAuth = () => {
      const token = authService.getAccessToken();
      
      if (token) {
        // Token exists, user is authenticated
        // In a real app, you might want to verify the token or fetch user info
        // For now, we'll set a minimal user object
        setUser({ authenticated: true });
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  /**
   * Login function
   * Authenticates user and stores tokens
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} User data
   * Validates: Requirements 13.1, 13.6
   */
  const login = async (email, password) => {
    try {
      const userData = await authService.login(email, password);
      setUser(userData);
      return userData;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Logout function
   * Clears tokens and user state
   * Validates: Requirements 13.6
   */
  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      // Always clear user state, even if logout request fails
      setUser(null);
    }
  };

  /**
   * Signup function
   * Creates new user account and auto-logs in
   * @param {string} name - User's full name
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} User data
   * Validates: Requirements 13.1, 13.6
   */
  const signup = async (name, email, password) => {
    try {
      // Create account
      await authService.signup(name, email, password);
      
      // Auto-login after successful signup
      const userData = await authService.login(email, password);
      setUser(userData);
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    login,
    logout,
    signup,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use auth context
 * Must be used within AuthProvider
 * @returns {Object} Auth context value
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  
  return context;
}

export default AuthContext;
