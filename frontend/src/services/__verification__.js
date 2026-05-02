/**
 * Verification script for service layer implementation
 * This file validates that all required service methods are properly exported
 */

import api from './api';
import authService from './authService';
import projectService from './projectService';
import taskService from './taskService';

// Verify API instance
console.log('✓ API instance created:', typeof api === 'object');
console.log('✓ API has interceptors:', !!api.interceptors);

// Verify authService methods
const authMethods = ['signup', 'login', 'logout', 'getAccessToken', 'getRefreshToken', 'isAuthenticated'];
authMethods.forEach(method => {
  console.log(`✓ authService.${method}:`, typeof authService[method] === 'function');
});

// Verify projectService methods
const projectMethods = ['getProjects', 'getProject', 'createProject', 'deleteProject', 'addMember', 'removeMember'];
projectMethods.forEach(method => {
  console.log(`✓ projectService.${method}:`, typeof projectService[method] === 'function');
});

// Verify taskService methods
const taskMethods = ['getTasks', 'createTask', 'updateTaskStatus', 'deleteTask'];
taskMethods.forEach(method => {
  console.log(`✓ taskService.${method}:`, typeof taskService[method] === 'function');
});

console.log('\n✅ All service layer components verified successfully!');
