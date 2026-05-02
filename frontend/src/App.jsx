import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Header from './components/layout/Header';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import ProjectForm from './pages/ProjectForm';
import TaskList from './pages/TaskList';
import TaskForm from './pages/TaskForm';

/**
 * Layout wrapper for protected routes
 * Includes Header navigation component
 */
function ProtectedLayout({ children }) {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-100">
        {children}
      </main>
    </>
  );
}

/**
 * Main App component
 * Sets up routing and authentication context
 * Validates: Requirements 13.7, 13.8, 14.1, 14.2, 14.3, 14.4
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Protected routes with Header */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Dashboard />
                </ProtectedLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/projects" 
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <ProjectList />
                </ProtectedLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/projects/new" 
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <ProjectForm />
                </ProtectedLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/projects/:id" 
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <ProjectDetail />
                </ProtectedLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tasks" 
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <TaskList />
                </ProtectedLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tasks/new" 
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <TaskForm />
                </ProtectedLayout>
              </ProtectedRoute>
            } 
          />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
