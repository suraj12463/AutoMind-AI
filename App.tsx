import React, { useState, useCallback, useEffect } from 'react';
import { Tab, CarData, DrivingAnalyticsData, MaintenanceItem, ChatMessage, EcoSuggestion, RoutePoint, TripDetails, SensorDataStream, DiagnosticEvent } from './types';
import { getCopilotResponse, getInitialAppData } from './services/geminiService';
import Sidebar from './components/Sidebar';
import Diagnostics from './components/Diagnostics';
import DrivingAnalytics from './components/DrivingAnalytics';
import Maintenance from './components/Maintenance';
import EcoOptimizer from './components/EcoOptimizer';
import Copilot from './components/Copilot';
import DashboardOverview from './components/DashboardOverview';
import LiveInteraction from './components/LiveInteraction'; // New import

const mockCarData: CarData = {
  make: 'Tesla',
  model: 'Model Y',
  year: 2023,
  vin: '5YJYGDEE8PF0XXXXX',
  odometer: 12543,
  fuelLevel: 88, // For EVs, this is battery level
  batteryHealth: 98,
  tirePressure: { frontLeft: 42, frontRight: 42, rearLeft: 43, rearRight: 43 },
  engineStatus: 'Warning', // For an EV, this can represent the powertrain system
  transmissionStatus: 'OK',
  brakesStatus: 'OK',
  faultCodes: ['P0D27'], // EV-specific fault code: Battery Charger Input Voltage Too Low
};

const mockDrivingData: DrivingAnalyticsData[] = [
  { name: 'Mon', acceleration: 85, braking: 92, efficiency: 78 },
  { name: 'Tue', acceleration: 88, braking: 95, efficiency: 82 },
  { name: 'Wed', acceleration: 76, braking: 88, efficiency: 75 },
  { name: 'Thu', acceleration: 91, braking: 94, efficiency: 85 },
  { name: 'Fri', acceleration: 82, braking: 90, efficiency: 79 },
  { name: 'Sat', acceleration: 95, braking: 98, efficiency: 91 },
  { name: 'Sun', acceleration: 93, braking: 96, efficiency: 88 },
];

const fallbackMaintenanceData: MaintenanceItem[] = [
  { component: 'Tire Rotation', lifeRemaining: 0.25, nextServiceKm: 2500, status: 'Soon' },
  { component: 'Cabin Air Filter', lifeRemaining: 0.65, nextServiceKm: 7500, status: 'OK' },
  { component: 'Brake Fluid', lifeRemaining: 0.80, nextServiceKm: 15000, status: 'OK' },
  { component: 'Battery Coolant', lifeRemaining: 0.90, nextServiceKm: 40000, status: 'OK' },
];


const mockEcoSuggestions: EcoSuggestion[] = [
    { title: "Optimal Charging", description: "Charge between 20-80% to maximize battery lifespan. Schedule charging during off-peak hours.", impact: "High" },
    { title: "Tire Pressure", description: "Properly inflated tires can improve efficiency by up to 3%. Check monthly.", impact: "Medium" },
    { title: "Smooth Driving", description: "Avoid rapid acceleration and hard braking to conserve energy.", impact: "High" },
    { title: "Reduce Idle Time", description: "Minimize time spent idling with climate control on to save energy.", impact: "Low" }
];

const mockRouteHistory: RoutePoint[] = [
  { lat: 37.7749, lng: -122.4194 },
  { lat: 37.7752, lng: -122.4162 },
  { lat: 37.7765, lng: -122.4132 },
  { lat: 37.7789, lng: -122.4111 },
  { lat: 37.7815, lng: -122.4095 },
  { lat: 37.7832, lng: -122.4071 },
  { lat: 37.7845, lng: -122.4050 },
];

const mockTripDetails: TripDetails[] = [
    { id: 1, pointIndex: 1, title: 'Morning Commute', details: 'Duration: 25 mins, Efficiency: 92/100' },
    { id: 2, pointIndex: 4, title: 'Quick Errand', details: 'Duration: 10 mins, Efficiency: 85/100. One harsh brake.' },
];

const mockLiveSensorData: SensorDataStream[] = [
  { name: 'Battery Cell Temp Avg', unit: '°C', readings: [{timestamp: 1, value: 32}, {timestamp: 2, value: 32.1}, {timestamp: 3, value: 32.2}, {timestamp: 4, value: 32.3}, {timestamp: 5, value: 32.2}, {timestamp: 6, value: 32.4}, {timestamp: 7, value: 32.5}, {timestamp: 8, value: 32.6}] },
  { name: 'Motor RPM', unit: 'rpm', readings: [{timestamp: 1, value: 0}, {timestamp: 2, value: 1500}, {timestamp: 3, value: 3000}, {timestamp: 4, value: 2500}, {timestamp: 5, value: 4000}, {timestamp: 6, value: 4200}, {timestamp: 7, value: 3800}, {timestamp: 8, value: 1000}] },
  { name: 'Front-Right Wheel Vibration', unit: 'm/s²', readings: [{timestamp: 1, value: 0.1}, {timestamp: 2, value: 0.12}, {timestamp: 3, value: 0.11}, {timestamp: 4, value: 0.13}, {timestamp: 5, value: 0.12}, {timestamp: 6, value: 0.14}, {timestamp: 7, value: 0.13}, {timestamp: 8, value: 0.15}] },
];

const mockDiagnosticHistory: DiagnosticEvent[] = [
  {
    id: 'evt_1',
    timestamp: Date.now() - (3 * 24 * 60 * 60 * 1000), // 3 days ago
    faultCodes: ['P0D27'],
    environmentalData: { outsideTemp: 5, altitude: 1200 },
    sensorSnapshot: [
      { name: 'Charger Input Voltage', unit: 'V', readings: [{timestamp: 1, value: 240}, {timestamp: 2, value: 238}, {timestamp: 3, value: 239}, {timestamp: 4, value: 105}, {timestamp: 5, value: 106}, {timestamp: 6, value: 241}] },
      { name: 'Battery State of Charge', unit: '%', readings: [{timestamp: 1, value: 45}, {timestamp: 2, value: 46}, {timestamp: 3, value: 47}, {timestamp: 4, value: 47}, {timestamp: 5, value: 47}, {timestamp: 6, value: 48}] }
    ]
  },
   {
    id: 'evt_2',
    timestamp: Date.now() - (10 * 24 * 60 * 60 * 1000), // 10 days ago
    faultCodes: ['U0100'],
    environmentalData: { outsideTemp: 25, altitude: 50 },
    sensorSnapshot: [
      { name: 'CAN Bus Voltage', unit: 'V', readings: [{timestamp: 1, value: 2.5}, {timestamp: 2, value: 2.51}, {timestamp: 3, value: 0}, {timestamp: 4, value: 0}, {timestamp: 5, value: 2.49}, {timestamp: 6, value: 2.5}] }
    ]
  }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [carData] = useState<CarData>(mockCarData);
  const [drivingData] = useState<DrivingAnalyticsData[]>(mockDrivingData);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceItem[]>([]);
  const [ecoSuggestions] = useState<EcoSuggestion[]>(mockEcoSuggestions);
  const [routeHistory] = useState<RoutePoint[]>(mockRouteHistory);
  const [tripDetails] = useState<TripDetails[]>(mockTripDetails);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userLocation, setUserLocation] = useState<GeolocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [dashboardInsight, setDashboardInsight] = useState<string>('');
  const [liveSensorData] = useState<SensorDataStream[]>(mockLiveSensorData);
  const [diagnosticHistory] = useState<DiagnosticEvent[]>(mockDiagnosticHistory);
  const [faultCodeExplanations, setFaultCodeExplanations] = useState<Record<string, string>>({});


  // Consolidated loading states
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false); // Only for follow-up messages

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser. Live location features will be disabled.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation(position.coords);
        setLocationError(null); // Clear previous errors on success
      },
      (error) => {
        console.warn("User location request failed:", error.message); // Changed to warn as this is often user-driven
        let errorMessage = "An unknown error occurred while getting your location. Live features will be disabled.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Live map features are disabled because location access was denied. To enable them, please update your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Your location could not be determined at this time. Please try again later.";
            break;
          case error.TIMEOUT:
            errorMessage = "The request for your location timed out. Please check your connection and try again.";
            break;
        }
        setLocationError(errorMessage);
        setUserLocation(null); // Ensure location is null on error
      }
    );
  }, []);

  // Consolidated initial data fetch to avoid rate-limiting errors
  useEffect(() => {
    const fetchInitialData = async () => {
        setIsAppLoading(true);
        try {
            const { maintenanceSchedule, dashboardInsight, initialGreeting, faultCodeExplanations } = await getInitialAppData(carData, drivingData, fallbackMaintenanceData);
            setMaintenanceData(maintenanceSchedule);
            setDashboardInsight(dashboardInsight);
            setChatHistory([{ sender: 'ai', ...initialGreeting }]);
            
            const explanationsMap = faultCodeExplanations.reduce((acc, item) => {
                acc[item.code] = item.explanation;
                return acc;
            }, {} as Record<string, string>);
            setFaultCodeExplanations(explanationsMap);

        } catch (error) {
            console.error("Failed to fetch initial app data:", error);
            // Fallback is handled in the service, but log here for debugging.
        } finally {
            setIsAppLoading(false);
        }
    };
    fetchInitialData();
  }, [carData, drivingData]);


  const handleSendMessage = useCallback(async (message: string) => {
    const currentHistory = [...chatHistory];
    
    // Optimistically remove suggestions from the last AI message and add the user's message
    setChatHistory(prev => {
        const newHistory = prev.map(m => ({ ...m }));
        const lastMessage = newHistory[newHistory.length - 1];
        if (lastMessage?.sender === 'ai' && lastMessage.suggestions) {
            delete lastMessage.suggestions;
        }
        newHistory.push({ sender: 'user', text: message });
        return newHistory;
    });

    setIsCopilotLoading(true);
    
    try {
      const response = await getCopilotResponse(message, carData, currentHistory);
      setChatHistory(prev => [...prev, { sender: 'ai', text: response.text, suggestions: response.suggestions }]);
    } catch (error) {
      console.error("Gemini API error:", error);
      setChatHistory(prev => [...prev, { sender: 'ai', text: "Sorry, I'm having trouble connecting right now. Please try again later.", suggestions: [] }]);
    } finally {
      setIsCopilotLoading(false);
    }
  }, [carData, chatHistory]);

  const renderContent = () => {
    switch (activeTab) {
      case Tab.DASHBOARD:
        // FIX: Pass fault code data to the dashboard so it can be passed to the compact Diagnostics component.
        return <DashboardOverview carData={carData} maintenanceData={maintenanceData} insight={dashboardInsight} isInsightLoading={isAppLoading} isMaintenanceLoading={isAppLoading} faultCodeExplanations={faultCodeExplanations} isLoadingExplanations={isAppLoading && carData.faultCodes.length > 0} />;
      case Tab.DIAGNOSTICS:
        return <Diagnostics carData={carData} liveSensorData={liveSensorData} diagnosticHistory={diagnosticHistory} faultCodeExplanations={faultCodeExplanations} isLoadingExplanations={isAppLoading && carData.faultCodes.length > 0} />;
      case Tab.ANALYTICS:
        return <DrivingAnalytics drivingData={drivingData} routeHistory={routeHistory} tripDetails={tripDetails} currentLocation={userLocation} carData={carData} />;
      case Tab.MAINTENANCE:
        return <Maintenance maintenanceData={maintenanceData} isLoading={isAppLoading} />;
      case Tab.ECO:
        return <EcoOptimizer suggestions={ecoSuggestions} carData={carData} />;
      case Tab.COPILOT:
        return <Copilot chatHistory={chatHistory} onSendMessage={handleSendMessage} isLoading={isCopilotLoading || (chatHistory.length === 0 && isAppLoading)} />;
      case Tab.LIVE: // New case for LiveInteraction
        return <LiveInteraction />;
      default:
        // FIX: Pass fault code data to the dashboard so it can be passed to the compact Diagnostics component.
        return <DashboardOverview carData={carData} maintenanceData={maintenanceData} insight={dashboardInsight} isInsightLoading={isAppLoading} isMaintenanceLoading={isAppLoading} faultCodeExplanations={faultCodeExplanations} isLoadingExplanations={isAppLoading && carData.faultCodes.length > 0} />;
    }
  };

  return (
    <div className="flex h-screen bg-brand-dark text-gray-200 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 p-8 overflow-y-auto">
        {locationError && (
          <div className="bg-yellow-900 border border-yellow-700 text-yellow-200 px-4 py-3 rounded-lg mb-6 flex justify-between items-start" role="alert">
            <div className="flex items-start">
              <svg className="fill-current h-6 w-6 text-yellow-500 mr-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zM9 5v6h2V5H9zm0 8h2v-2H9v2z"/></svg>
              <div>
                <p className="font-bold">Location Services Disabled</p>
                <p className="text-sm">{locationError}</p>
              </div>
            </div>
            <button
              onClick={() => setLocationError(null)}
              className="text-yellow-200 hover:text-white transition-colors ml-4 flex-shrink-0"
              aria-label="Dismiss notification"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
            </button>
          </div>
        )}
        <header className="mb-8">
            <h1 className="text-3xl font-bold text-white">{activeTab}</h1>
            {activeTab === Tab.DASHBOARD && <p className="text-brand-gray mt-1">
                Welcome back! Here's the latest on your {carData.make} {carData.model}.
            </p>}
        </header>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;