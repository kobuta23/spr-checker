import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle }) => {
  return (
    <div className="text-center mb-8">
      <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 text-xl text-gray-500">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default PageHeader; 