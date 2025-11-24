import React from 'react';
import { LayoutDashboard, Map, History, Settings, Leaf } from 'lucide-react';
import { View } from '../types';

interface HeaderProps {
  currentView: View;
  setView: (view: View) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
  const navItems: { id: View; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner', label: 'Reiseplaner', icon: Map },
    { id: 'history', label: 'Meine Reisen', icon: History },
  ];

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-emerald-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="bg-emerald-600 p-2 rounded-lg mr-3">
              <Leaf className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-emerald-900 tracking-tight">EcoTravel</span>
          </div>

          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  currentView === item.id
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-gray-600 hover:text-emerald-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setView('settings')}
            className="p-2 text-gray-400 hover:text-emerald-600 transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-6 w-6" />
          </button>
        </div>
      </div>
      {/* Mobile Nav */}
      <div className="md:hidden border-t border-gray-200 bg-white flex justify-around p-2">
         {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center px-3 py-2 rounded-md text-xs font-medium ${
                  currentView === item.id
                    ? 'text-emerald-700'
                    : 'text-gray-500'
                }`}
              >
                <item.icon className="h-5 w-5 mb-1" />
                {item.label}
              </button>
            ))}
      </div>
    </header>
  );
};
