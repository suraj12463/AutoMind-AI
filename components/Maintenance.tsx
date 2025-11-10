import React from 'react';
import { MaintenanceItem } from '../types';
import { LightbulbIcon, WrenchIcon } from './icons';

interface MaintenanceProps {
  maintenanceData: MaintenanceItem[];
  isLoading: boolean;
  isCompact?: boolean;
}

const Maintenance: React.FC<MaintenanceProps> = ({ maintenanceData, isLoading, isCompact = false }) => {
  const statusColorMap = {
    OK: 'bg-green-500',
    Soon: 'bg-yellow-500',
    Overdue: 'bg-red-500',
  };

  const renderSkeleton = () => (
    <ul className="space-y-6">
      {[...Array(3)].map((_, index) => (
        <li key={index} className="animate-pulse">
          <div className="flex justify-between items-center mb-1">
            <div className="h-5 bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5"></div>
           <div className="mt-3 space-y-2">
            <div className="flex items-start gap-2">
                <div className="w-4 h-4 bg-gray-700 rounded-full mt-0.5 flex-shrink-0"></div>
                <div className="h-4 bg-gray-700 rounded w-full"></div>
            </div>
             <div className="flex items-start gap-2">
                <div className="w-4 h-4 bg-gray-700 rounded-full mt-0.5 flex-shrink-0"></div>
                <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
           </div>
        </li>
      ))}
    </ul>
  );

  if (isLoading && !isCompact) {
    return (
      <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Personalized Maintenance Schedule</h2>
        {renderSkeleton()}
      </div>
    );
  }

  return (
    <div className={isCompact ? 'space-y-4' : 'bg-brand-dark-2 p-6 rounded-lg border border-gray-700'}>
      {!isCompact && <h2 className="text-lg font-semibold text-white mb-4">Personalized Maintenance Schedule</h2>}
      <ul className="space-y-6">
        {maintenanceData.map((item) => (
          <li key={item.component}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-white">{item.component}</span>
              <span className="text-sm text-brand-gray">{item.nextServiceKm.toLocaleString()} km remaining</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${statusColorMap[item.status]}`}
                style={{ width: `${item.lifeRemaining * 100}%` }}
              ></div>
            </div>
            {item.aiInsight && (
              <div className="mt-3 flex items-start gap-3 text-sm text-blue-200 bg-brand-dark border-l-4 border-brand-blue p-3 rounded-r-lg">
                <LightbulbIcon className="w-5 h-5 mt-0.5 flex-shrink-0 text-brand-blue" />
                <p>
                  <span className="font-semibold text-white">AI Insight:</span> {item.aiInsight}
                </p>
              </div>
            )}
            {item.preventativeTip && (
              <div className="mt-2 flex items-start gap-3 text-sm text-gray-300 bg-brand-dark border-l-4 border-gray-600 p-3 rounded-r-lg">
                  <WrenchIcon className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400" />
                  <p>
                      <span className="font-semibold text-white">Actionable Tip:</span> {item.preventativeTip}
                  </p>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!isCompact && (
        <button className="mt-6 w-full bg-brand-blue text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
          Book Service Appointment
        </button>
      )}
    </div>
  );
};

export default Maintenance;