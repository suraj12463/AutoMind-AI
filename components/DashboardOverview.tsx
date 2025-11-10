import React from 'react';
import { CarData, MaintenanceItem } from '../types';
import StatCard from './StatCard';
import Diagnostics from './Diagnostics';
import Maintenance from './Maintenance';
import { OdometerIcon, BatteryIcon, TireIcon } from './icons';

interface DashboardOverviewProps {
  carData: CarData;
  maintenanceData: MaintenanceItem[];
  insight: string;
  isInsightLoading: boolean;
  isMaintenanceLoading: boolean;
  faultCodeExplanations: Record<string, string>;
  isLoadingExplanations: boolean;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ carData, maintenanceData, insight, isInsightLoading, isMaintenanceLoading, faultCodeExplanations, isLoadingExplanations }) => {
  const avgTirePressure = (
    (carData.tirePressure.frontLeft +
     carData.tirePressure.frontRight +
     carData.tirePressure.rearLeft +
     carData.tirePressure.rearRight) / 4
  ).toFixed(1);

  const renderInsight = () => {
    if (isInsightLoading) {
        return (
            <div className="flex items-center space-x-1 text-brand-gray">
                <span>Generating AI insight</span>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse-fast [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse-fast [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse-fast"></div>
            </div>
        );
    }
    return <p className="text-brand-gray">{insight}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Battery Level"
          value={`${carData.fuelLevel}%`}
          icon={<BatteryIcon className="w-6 h-6 text-green-400" />}
        />
        <StatCard
          title="Odometer"
          value={`${carData.odometer.toLocaleString()} km`}
          icon={<OdometerIcon className="w-6 h-6 text-blue-400" />}
        />
        <StatCard
          title="Avg. Tire Pressure"
          value={`${avgTirePressure} PSI`}
          icon={<TireIcon className="w-6 h-6 text-yellow-400" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
           <h3 className="text-lg font-semibold text-white mb-4">System Diagnostics</h3>
           {/* FIX: Pass faultCodeExplanations and isLoadingExplanations to Diagnostics to satisfy its required props. */}
           <Diagnostics carData={carData} isCompact={true} faultCodeExplanations={faultCodeExplanations} isLoadingExplanations={isLoadingExplanations} />
        </div>
        <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
           <h3 className="text-lg font-semibold text-white mb-4">Upcoming Maintenance</h3>
           {/* FIX: Pass the isLoading prop to the Maintenance component to satisfy its required props. */}
           <Maintenance maintenanceData={maintenanceData.slice(0, 3)} isCompact={true} isLoading={isMaintenanceLoading} />
        </div>
      </div>
       <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
           <h3 className="text-lg font-semibold text-white mb-4">AI Insight</h3>
            {renderInsight()}
            <button className="text-sm mt-3 text-brand-blue font-semibold hover:underline">
                Ask AI Copilot for more tips →
            </button>
       </div>
    </div>
  );
};

export default DashboardOverview;