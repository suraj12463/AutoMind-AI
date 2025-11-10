import React from 'react';
import { Tab } from '../types';
import { DashboardIcon, DiagnosticsIcon, AnalyticsIcon, MaintenanceIcon, EcoIcon, CopilotIcon, LiveIcon } from './icons';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: Tab;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
        isActive
          ? 'bg-brand-blue text-white'
          : 'text-brand-gray hover:bg-brand-dark-2 hover:text-white'
      }`}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { icon: <DashboardIcon className="w-5 h-5" />, label: Tab.DASHBOARD },
    { icon: <DiagnosticsIcon className="w-5 h-5" />, label: Tab.DIAGNOSTICS },
    { icon: <AnalyticsIcon className="w-5 h-5" />, label: Tab.ANALYTICS },
    { icon: <MaintenanceIcon className="w-5 h-5" />, label: Tab.MAINTENANCE },
    { icon: <EcoIcon className="w-5 h-5" />, label: Tab.ECO },
    { icon: <CopilotIcon className="w-5 h-5" />, label: Tab.COPILOT },
    { icon: <LiveIcon className="w-5 h-5" />, label: Tab.LIVE },
  ];

  return (
    <aside className="w-64 bg-brand-dark-2 p-4 border-r border-gray-700 flex flex-col">
      <div className="flex items-center mb-8 px-2">
        <img src="https://picsum.photos/40/40" alt="AutoMind Logo" className="rounded-full" />
        <h2 className="text-xl font-bold text-white ml-3">AutoMind AI</h2>
      </div>
      <nav className="flex flex-col space-y-2">
        {navItems.map((item) => (
          <NavItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            isActive={activeTab === item.label}
            onClick={() => setActiveTab(item.label)}
          />
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;