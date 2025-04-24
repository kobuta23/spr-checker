import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/authContext';

export const useLogin = (redirectTo: string = '/') => {
  const { login, error: authError, loading: authLoading } = useAuth();
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value);
    // Clear any previous errors when user types
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setError('Please enter a valid authentication code');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await login(code);
      
      // Only navigate if there was no error from the auth context
      if (!authError) {
        navigate(redirectTo);
      }
    } catch (err) {
      console.error('Login submission error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return {
    code,
    error: error || authError,
    loading: loading || authLoading,
    handleCodeChange,
    handleSubmit,
    setCode,
  };
}; 