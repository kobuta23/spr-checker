import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../utils/authContext';

type ProtectedRouteProps = {
  redirectPath?: string;
};

/**
 * A wrapper component that protects routes requiring authentication
 * Redirects unauthenticated users to the login page
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  redirectPath = '/login'
}) => {
  const { isAuthenticated, loading } = useAuth();
  
  // Show loading spinner while checking authentication status
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }
  
  // Render the protected route content
  return <Outlet />;
};

export default ProtectedRoute; 