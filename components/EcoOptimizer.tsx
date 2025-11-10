import React from 'react';
import { EcoSuggestion, CarData } from '../types';

interface EcoOptimizerProps {
  suggestions: EcoSuggestion[];
  carData: CarData;
}

const ImpactBadge: React.FC<{ impact: 'High' | 'Medium' | 'Low' }> = ({ impact }) => {
  const colorMap = {
    High: 'bg-red-500 text-red-100',
    Medium: 'bg-yellow-500 text-yellow-100',
    Low: 'bg-green-500 text-green-100',
  };
  return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorMap[impact]}`}>{impact} Impact</span>;
};

const EcoOptimizer: React.FC<EcoOptimizerProps> = ({ suggestions, carData }) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700 text-center">
            <h3 className="text-brand-gray text-sm font-medium">Real-Time Efficiency</h3>
            <p className="text-4xl font-bold text-green-500 mt-1">25 kWh/100km</p>
        </div>
        <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700 text-center">
            <h3 className="text-brand-gray text-sm font-medium">Cost per Kilometer</h3>
            <p className="text-4xl font-bold text-green-500 mt-1">$0.04</p>
        </div>
        <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700 text-center">
            <h3 className="text-brand-gray text-sm font-medium">CO₂ Savings (vs Gas)</h3>
            <p className="text-4xl font-bold text-green-500 mt-1">1.5 Tonnes</p>
        </div>
      </div>
      
      <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Efficiency Suggestions</h2>
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="bg-brand-dark p-4 rounded-lg border border-gray-800">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-white">{suggestion.title}</h3>
                  <p className="text-sm text-brand-gray mt-1">{suggestion.description}</p>
                </div>
                <ImpactBadge impact={suggestion.impact} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EcoOptimizer;
