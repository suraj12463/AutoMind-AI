import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => {
  return (
    <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700 flex items-center justify-between transition-all hover:border-brand-blue hover:shadow-lg">
      <div>
        <p className="text-sm text-brand-gray font-medium">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
      <div className="bg-gray-800 p-3 rounded-full">
        {icon}
      </div>
    </div>
  );
};

export default StatCard;
