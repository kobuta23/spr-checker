import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  authCode: string | null;
  error: string | null;
  login: (code: string) => Promise<void>;
  logout: () => void;
  setAuthCode: (code: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already authenticated on mount
  useEffect(() => {
    console.log("AuthProvider mounted - checking authentication status");
    const checkAuthStatus = async () => {
      try {
        // Check for token in localStorage
        const token = localStorage.getItem('auth_token');
        console.log("Token from localStorage:", token ? "Found" : "Not found");
        
        if (token) {
          // Verify token with backend
          console.log("Verifying token with backend");
          const response = await fetch('/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            console.log("Token verified successfully");
            setIsAuthenticated(true);
          } else {
            console.log("Token verification failed, status:", response.status);
            // Token invalid, clear it
            localStorage.removeItem('auth_token');
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
        console.log("Auth check completed, authenticated:", isAuthenticated);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (code: string) => {
    console.log("Login function called with code:", code);
    setLoading(true);
    setError(null);
    
    try {
      console.log("Sending login request to /api/auth/login");
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      
      const data = await response.json();
      console.log("Login response status:", response.status);
      console.log("Login response data:", data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }
      
      // Save token to localStorage
      console.log("Saving token to localStorage");
      localStorage.setItem('auth_token', data.token);
      setIsAuthenticated(true);
      console.log("Login successful, authentication state updated");
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
      setAuthCode(null);
    }
  };

  const logout = () => {
    console.log("Logout function called");
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setAuthCode(null);
    console.log("Logged out, authentication state reset");
  };

  const value = {
    isAuthenticated,
    loading,
    authCode,
    error,
    login,
    logout,
    setAuthCode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}; 