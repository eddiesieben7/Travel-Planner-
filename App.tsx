
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TripPlanner } from './components/TripPlanner';
import { SettingsModal } from './components/SettingsModal';
import { TripHistory } from './components/TripHistory';
import { UserSettings, Trip, View } from './types';

const App: React.FC = () => {
  // State Management
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('ecoTravel_settings');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      annualBudget: parsed.annualBudget || 5000,
      annualCo2Limit: parsed.annualCo2Limit || 2000,
      hasOnboarded: parsed.hasOnboarded || false,
      serpApiKey: parsed.serpApiKey || ''
    };
  });

  const [trips, setTrips] = useState<Trip[]>(() => {
    const saved = localStorage.getItem('ecoTravel_trips');
    return saved ? JSON.parse(saved) : [];
  });

  const [view, setView] = useState<View>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(!userSettings.hasOnboarded);

  // Persistence
  useEffect(() => {
    localStorage.setItem('ecoTravel_settings', JSON.stringify(userSettings));
  }, [userSettings]);

  useEffect(() => {
    localStorage.setItem('ecoTravel_trips', JSON.stringify(trips));
  }, [trips]);

  // Handlers
  const handleAddTrip = (trip: Trip) => {
    setTrips(prev => [...prev, trip]);
  };

  const handleSaveSettings = (newSettings: UserSettings) => {
    setUserSettings(newSettings);
  };

  const renderContent = () => {
    switch (view) {
      case 'dashboard':
        return (
          <Dashboard 
            userSettings={userSettings} 
            trips={trips} 
            onEditLimits={() => setIsSettingsOpen(true)}
          />
        );
      case 'planner':
        return (
          <TripPlanner 
            userSettings={userSettings} 
            currentTrips={trips} 
            addTrip={handleAddTrip} 
          />
        );
      case 'history':
        return <TripHistory trips={trips} />;
      case 'settings':
        // Although handled by modal, we can show a placeholder or trigger the modal
        setTimeout(() => {
            setIsSettingsOpen(true);
            setView('dashboard'); // Go back to dashboard behind modal
        }, 0);
        return (
          <Dashboard 
            userSettings={userSettings} 
            trips={trips} 
            onEditLimits={() => setIsSettingsOpen(true)}
          />
        );
      default:
        return (
          <Dashboard 
            userSettings={userSettings} 
            trips={trips} 
            onEditLimits={() => setIsSettingsOpen(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-[#193000]">
      <Header currentView={view} setView={setView} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={userSettings} 
        onSave={handleSaveSettings} 
      />
    </div>
  );
};

export default App;
