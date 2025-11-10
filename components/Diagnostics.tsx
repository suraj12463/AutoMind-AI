import React, { useState } from 'react';
import { CarData, SensorDataStream, DiagnosticEvent } from '../types';
import { EngineIcon, TransmissionIcon, BrakesIcon, BatteryIcon, ChevronDownIcon } from './icons';
import { getAdvancedDiagnosticAnalysis } from '../services/geminiService';
import MiniSparkline from './MiniSparkline';

interface DiagnosticsProps {
  carData: CarData;
  isCompact?: boolean;
  liveSensorData?: SensorDataStream[];
  diagnosticHistory?: DiagnosticEvent[];
  faultCodeExplanations: Record<string, string>;
  isLoadingExplanations: boolean;
}

const StatusIndicator: React.FC<{ status: 'OK' | 'Warning' | 'Critical' }> = ({ status }) => {
  const statusConfig = {
    OK: { text: 'OK', color: 'text-green-500' },
    Warning: { text: 'Warning', color: 'text-yellow-500' },
    Critical: { text: 'Critical', color: 'text-red-500' },
  };
  return <span className={`font-semibold ${statusConfig[status].color}`}>{statusConfig[status].text}</span>;
};

const Diagnostics: React.FC<DiagnosticsProps> = ({ carData, isCompact = false, liveSensorData = [], diagnosticHistory = [], faultCodeExplanations, isLoadingExplanations }) => {
  // State for advanced analysis
  const [analysisResult, setAnalysisResult] = useState<Record<string, string>>({});
  const [loadingAnalysisId, setLoadingAnalysisId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const handleToggleAnalysis = async (event: DiagnosticEvent) => {
    const { id } = event;
    // If it's already expanded, collapse it
    if (expandedEventId === id) {
        setExpandedEventId(null);
        return;
    }
    
    // Expand the new one
    setExpandedEventId(id);

    // If we don't have a result yet, fetch it
    if (!analysisResult[id]) {
        setLoadingAnalysisId(id);
        try {
            const result = await getAdvancedDiagnosticAnalysis(event, carData);
            setAnalysisResult(prev => ({ ...prev, [id]: result }));
        } catch (error) {
            console.error("Failed to fetch advanced analysis:", error);
            setAnalysisResult(prev => ({ ...prev, [id]: "<p>Could not perform AI analysis for this event. Please try again later.</p>" }));
        } finally {
            setLoadingAnalysisId(null);
        }
    }
  };


  const diagnosticItems = [
    { name: 'Powertrain', status: carData.engineStatus, icon: <EngineIcon className="w-6 h-6 text-brand-gray" /> },
    { name: 'Transmission', status: carData.transmissionStatus, icon: <TransmissionIcon className="w-6 h-6 text-brand-gray" /> },
    { name: 'Brakes', status: carData.brakesStatus, icon: <BrakesIcon className="w-6 h-6 text-brand-gray" /> },
    { name: 'Battery System', status: carData.batteryHealth > 80 ? 'OK' : 'Warning', icon: <BatteryIcon className="w-6 h-6 text-brand-gray" /> },
  ];

  const overallHealth = Math.min(carData.batteryHealth, carData.engineStatus === 'OK' ? 100 : 50, carData.brakesStatus === 'OK' ? 100 : 50);

  const renderFaultCodes = () => {
    if (isCompact || !carData.faultCodes || carData.faultCodes.length === 0) {
      return null;
    }

    return (
      <div className="bg-brand-dark-2 p-6 rounded-lg border border-yellow-700">
        <h3 className="text-lg font-semibold text-yellow-400 mb-4">Active Fault Codes</h3>
        <div className="space-y-4">
          {carData.faultCodes.map((code) => (
            <div key={code} className="bg-brand-dark p-4 rounded-lg border border-gray-800">
              <p className="font-mono font-bold text-white text-lg">{code}</p>
              <div className="mt-2 text-sm text-gray-300">
                {isLoadingExplanations ? (
                  <div className="space-y-2 pt-2">
                    <div className="h-4 bg-gray-700 rounded w-3/4 animate-pulse"></div>
                    <div className="h-4 bg-gray-700 rounded w-1/2 animate-pulse"></div>
                    <div className="h-4 bg-gray-700 rounded w-5/6 animate-pulse"></div>
                  </div>
                ) : (
                  <div className="ai-content" dangerouslySetInnerHTML={{ __html: faultCodeExplanations[code] ?? '<p>Explanation not available.</p>' }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLiveSensors = () => {
    if (isCompact || liveSensorData.length === 0) return null;
    return (
      <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Live Sensor Monitoring</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {liveSensorData.map(stream => (
                <div key={stream.name} className="bg-brand-dark p-4 rounded-lg border border-gray-800">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-brand-gray">{stream.name}</p>
                            <p className="text-xl font-bold text-white">{stream.readings[stream.readings.length - 1].value.toFixed(1)} <span className="text-sm font-normal text-brand-gray">{stream.unit}</span></p>
                        </div>
                        <MiniSparkline data={stream.readings.map(r => r.value)} />
                    </div>
                </div>
            ))}
        </div>
      </div>
    );
  };

  const renderDiagnosticHistory = () => {
    if (isCompact || diagnosticHistory.length === 0) return null;
    return (
        <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Diagnostic Event History</h3>
            <div className="space-y-4">
                {diagnosticHistory.map(event => {
                    const isExpanded = expandedEventId === event.id;
                    const isLoading = loadingAnalysisId === event.id;
                    const hasAnalysis = !!analysisResult[event.id];

                    if (!hasAnalysis) {
                        return (
                            <div key={event.id} className="bg-brand-dark p-6 rounded-lg border border-dashed border-gray-600 text-center transition-all hover:border-brand-blue">
                                <p className="font-bold text-white">Event: {event.faultCodes.join(', ')}</p>
                                <p className="text-sm text-brand-gray mb-4">{new Date(event.timestamp).toLocaleString()}</p>
                                <p className="text-sm text-gray-300 mb-4 max-w-md mx-auto">Get a deep root cause analysis, contributing factors, and a recommended action plan for this event.</p>
                                <button
                                    onClick={() => handleToggleAnalysis(event)}
                                    disabled={isLoading}
                                    className="bg-brand-blue text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Analyzing...' : 'Analyze with AI'}
                                </button>
                            </div>
                        );
                    }
                    
                    const buttonText = isExpanded ? "Hide Analysis" : "Show Analysis";
                    return (
                        <div key={event.id} className="bg-brand-dark p-4 rounded-lg border border-gray-800">
                            <div className="flex justify-between items-start cursor-pointer" onClick={() => handleToggleAnalysis(event)}>
                                <div>
                                    <p className="font-bold text-white">Event: {event.faultCodes.join(', ')}</p>
                                    <p className="text-sm text-brand-gray">{new Date(event.timestamp).toLocaleString()}</p>
                                </div>
                                <button className="flex items-center gap-2 bg-gray-700 text-white font-semibold py-1.5 px-3 rounded-md text-sm hover:bg-gray-600 transition-colors">
                                    {buttonText}
                                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                            {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-gray-700">
                                    <div className="ai-content text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: analysisResult[event.id] ?? '' }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
      {!isCompact && (
        <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700 text-center">
            <h2 className="text-lg font-semibold text-white mb-2">Overall Vehicle Health</h2>
            <p className={`text-4xl font-bold ${overallHealth > 80 ? 'text-green-500' : 'text-yellow-500'}`}>{overallHealth}%</p>
            <p className="text-brand-gray text-sm mt-1">
              {carData.faultCodes.length > 0 ? "Attention needed for active fault codes." : "All systems are operating normally."}
            </p>
        </div>
      )}
      
      <div className={`grid ${isCompact ? 'grid-cols-2 gap-4' : 'grid-cols-1 md:grid-cols-2 gap-4'}`}>
        {diagnosticItems.map((item) => (
          <div key={item.name} className="bg-brand-dark p-4 rounded-lg border border-gray-800 flex items-center justify-between">
            <div className="flex items-center">
              {item.icon}
              <span className="ml-3 text-white">{item.name}</span>
            </div>
            <StatusIndicator status={item.status as 'OK' | 'Warning' | 'Critical'} />
          </div>
        ))}
      </div>

      {renderFaultCodes()}
      {renderLiveSensors()}
      {renderDiagnosticHistory()}
    </div>
  );
};

export default Diagnostics;