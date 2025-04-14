import React from 'react';

interface LoadingSpinnerProps {
  isLoading: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ isLoading }) => {
  if (!isLoading) return null;
  
  return (
    <div className="flex justify-center mt-6">
      <div className="loader">
        <div className="w-12 h-12 border-4 border-superfluid-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner; 