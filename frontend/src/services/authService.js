import api from './api';

/**
 * Authentication service for user signup, login, and logout
 * Validates: Requirements 13.1, 13.6
 */
export const authService = {
  /**
   * Sign up a new user
   * @param {string} name - User's full name
   * @param {string} email - User's email address
   * @param {string} password - User's password (min 8 characters)
   * @returns {Promise<Object>} User data (excluding password)
   * @throws {Error} If signup fails
   */
  async signup(name, email, password) {
    const response = await api.post('/api/auth/signup', {
      name,
      email,
      password
    });
    return response.data;
  },

  /**
   * Log in an existing user
   * Stores access token and refresh token in localStorage
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Promise<Object>} User data
   * @throws {Error} If login fails
   * Validates: Requirements 13.1, 13.6
   */
  async login(email, password) {
    const response = await api.post('/api/auth/login', {
      email,
      password
    });
    
    const { accessToken, refreshToken, user } = response.data;
    
    // Store tokens in localStorage
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    
    return user;
  },

  /**
   * Log out the current user
   * Invalidates refresh token on server and clears local storage
   * @returns {Promise<void>}
   * Validates: Requirements 13.6
   */
  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    try {
      // Attempt to invalidate refresh token on server
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } finally {
      // Always clear tokens from localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  },

  /**
   * Get the current access token from localStorage
   * @returns {string|null} Access token or null if not found
   */
  getAccessToken() {
    return localStorage.getItem('accessToken');
  },

  /**
   * Get the current refresh token from localStorage
   * @returns {string|null} Refresh token or null if not found
   */
  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  },

  /**
   * Check if user is authenticated (has valid access token)
   * Note: This only checks for token presence, not validity
   * @returns {boolean} True if access token exists
   */
  isAuthenticated() {
    return !!localStorage.getItem('accessToken');
  }
};

export default authService;
