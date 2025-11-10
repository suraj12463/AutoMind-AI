export enum Tab {
  DASHBOARD = 'Dashboard',
  DIAGNOSTICS = 'Diagnostics',
  ANALYTICS = 'Analytics',
  MAINTENANCE = 'Maintenance',
  ECO = 'Eco-Optimizer',
  COPILOT = 'AI Copilot',
  LIVE = 'Live',
}

export interface CarData {
  make: string;
  model: string;
  year: number;
  vin: string;
  odometer: number;
  fuelLevel: number; // percentage
  batteryHealth: number; // percentage
  tirePressure: {
    frontLeft: number;
    frontRight: number;
    rearLeft: number;
    rearRight: number;
  };
  engineStatus: 'OK' | 'Warning' | 'Critical';
  transmissionStatus: 'OK' | 'Warning';
  brakesStatus: 'OK' | 'Warning';
  faultCodes: string[];
}

export interface DrivingAnalyticsData {
  name: string;
  acceleration: number; // score out of 100
  braking: number; // score out of 100
  efficiency: number; // score out of 100
}

export interface MaintenanceItem {
  component: string;
  lifeRemaining: number; // percentage (0 to 1)
  nextServiceKm: number;
  aiInsight?: string;
  status: 'OK' | 'Soon' | 'Overdue';
  preventativeTip?: string;
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  suggestions?: string[];
}

export interface EcoSuggestion {
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface TripDetails {
  id: number;
  pointIndex: number; 
  title: string;
  details: string;
}

export interface SensorReading {
  timestamp: number; // Unix timestamp
  value: number;
}

export interface SensorDataStream {
  name: string;
  unit: string;
  readings: SensorReading[];
}

export interface DiagnosticEvent {
  id: string;
  timestamp: number;
  faultCodes: string[];
  environmentalData: {
    outsideTemp: number; // Celsius
    altitude: number; // meters
  };
  sensorSnapshot: SensorDataStream[];
}

export interface OptimizedRouteResult {
  optimizedRoute: RoutePoint[];
  timeSavedMinutes: number;
  energySavedPercent: number;
}