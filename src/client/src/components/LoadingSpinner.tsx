import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps {
  isLoading: boolean;
  size?: SpinnerSize;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  isLoading, 
  size = 'md' 
}) => {
  if (!isLoading) return null;
  
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };
  
  const spinnerClass = sizeClasses[size] || sizeClasses.md;
  
  return (
    <div className={size === 'sm' ? 'inline-flex mr-2' : 'flex justify-center mt-6'}>
      <div className="loader">
        <div className={`${spinnerClass} border-indigo-600 border-t-transparent rounded-full animate-spin`}></div>
      </div>
    </div>
  );
};

export default LoadingSpinner; 