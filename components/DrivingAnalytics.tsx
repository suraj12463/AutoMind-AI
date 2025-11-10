import React from 'react';
import { DrivingAnalyticsData, RoutePoint, TripDetails, CarData } from '../types';
import RouteMap from './RouteMap';

interface DrivingAnalyticsProps {
  drivingData: DrivingAnalyticsData[];
  routeHistory: RoutePoint[];
  tripDetails: TripDetails[];
  currentLocation: GeolocationCoordinates | null;
  carData: CarData;
}

const DrivingAnalytics: React.FC<DrivingAnalyticsProps> = ({ drivingData, routeHistory, tripDetails, currentLocation, carData }) => {
  // Access Recharts from the window object inside the component to avoid race conditions on load.
  const Recharts = (window as any).Recharts;
  
  const averageScore = Math.round(drivingData.reduce((acc, day) => acc + (day.acceleration + day.braking + day.efficiency) / 3, 0) / drivingData.length);

  const renderStatCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
        <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
          <h3 className="text-brand-gray text-sm font-medium">Overall Driving Score</h3>
          <p className="text-4xl font-bold text-brand-blue mt-1">{averageScore}/100</p>
        </div>
        <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
          <h3 className="text-brand-gray text-sm font-medium">Eco-Points Earned</h3>
          <p className="text-4xl font-bold text-green-500 mt-1">1,240</p>
        </div>
        <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
          <h3 className="text-brand-gray text-sm font-medium">Leaderboard Rank</h3>
          <p className="text-4xl font-bold text-yellow-500 mt-1">#12</p>
        </div>
    </div>
  );
  
  const renderChart = () => {
     // Guard clause if Recharts hasn't loaded yet
    if (!Recharts) {
      return (
          <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700 flex items-center justify-center" style={{height: 348}}>
              <p className="text-brand-gray">Loading chart library...</p>
          </div>
      )
    }

    const { ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } = Recharts;
    return (
       <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Weekly Performance</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={drivingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
              <XAxis dataKey="name" stroke="#A0AEC0" />
              <YAxis stroke="#A0AEC0" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}
                labelStyle={{ color: '#E2E8F0' }}
              />
              <Legend wrapperStyle={{ color: '#E2E8F0' }} />
              <Bar dataKey="acceleration" fill="#4299E1" name="Smooth Acceleration"/>
              <Bar dataKey="braking" fill="#38B2AC" name="Gentle Braking"/>
              <Line type="monotone" dataKey="efficiency" stroke="#FBBF24" name="Efficiency Score" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderRecentEvents = () => (
     <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Events</h3>
        <ul className="space-y-3">
            <li className="flex items-center text-sm"><span className="text-red-500 font-bold mr-2">●</span> Harsh Braking Detected - Main St & 1st Ave</li>
            <li className="flex items-center text-sm"><span className="text-yellow-500 font-bold mr-2">●</span> Rapid Acceleration - Highway 101 Exit</li>
            <li className="flex items-center text-sm"><span className="text-green-500 font-bold mr-2">●</span> 30 min of Efficient Cruising</li>
        </ul>
    </div>
  );
  
  return (
    <div className="space-y-8">
      {renderStatCards()}
      <div className="bg-brand-dark-2 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Trip History</h3>
        <RouteMap routeHistory={routeHistory} tripDetails={tripDetails} currentLocation={currentLocation} carData={carData} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {renderChart()}
        {renderRecentEvents()}
      </div>
    </div>
  );
};

export default DrivingAnalytics;