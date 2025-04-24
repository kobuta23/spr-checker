import React from 'react';
import { useLogin } from '../hooks/useLogin';

interface LoginProps {
  redirectTo?: string;
}

export const Login: React.FC<LoginProps> = ({ redirectTo = '/' }) => {
  const {
    code,
    error,
    loading,
    handleCodeChange,
    handleSubmit
  } = useLogin(redirectTo);

  return (
    <div className="w-full max-w-md mx-auto mt-10">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">Login</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label 
              htmlFor="code" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Authentication Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={handleCodeChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your auth code"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm mt-1">
              {error}
            </div>
          )}
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </div>
              ) : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 