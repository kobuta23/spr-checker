import React, { useState, useEffect } from 'react';
import { useAuth } from '../../utils/authContext';
import { useSearchParams, useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const [code, setCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, error, loading } = useAuth();
  const navigate = useNavigate();

  // Check for auth code in URL parameters on component mount
  useEffect(() => {
    const authCode = searchParams.get('code');
    if (authCode) {
      setCode(authCode);
      handleLogin(authCode);
    }
  }, [searchParams]);

  // Redirect to home if authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate('/');
    }
  }, [isAuthenticated, loading, navigate]);

  // Handle login form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(code);
  };

  // Handle login logic
  const handleLogin = async (authCode: string) => {
    if (!authCode.trim()) return;
    
    setIsSubmitting(true);
    await login(authCode);
    setIsSubmitting(false);
  };

  // If still checking authentication status, show loading
  if (loading && !error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">Admin Access</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="code" className="block text-gray-700 text-sm font-medium mb-2">
            Authentication Code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter your authentication code"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting || !code.trim()}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Authenticating...' : 'Log In'}
        </button>
      </form>
      
      <div className="mt-6 text-center text-sm text-gray-600">
        <p>Need an authentication code? Contact your administrator or use the <code>/admin</code> command in Discord.</p>
      </div>
    </div>
  );
};

export default LoginPage; 