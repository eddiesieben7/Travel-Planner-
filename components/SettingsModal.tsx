
import React, { useState } from 'react';
import { UserSettings } from '../types';
import { Save, X, Search, Key } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [budget, setBudget] = useState(settings.annualBudget);
  const [co2, setCo2] = useState(settings.annualCo2Limit);
  const [serpKey, setSerpKey] = useState(settings.serpApiKey || '');

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      ...settings,
      annualBudget: budget,
      annualCo2Limit: co2,
      hasOnboarded: true,
      serpApiKey: serpKey
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#193000]/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="bg-[#527510] p-6 text-white flex justify-between items-start">
          <div>
             <h2 className="text-2xl font-bold">Einstellungen</h2>
             <p className="text-[#BFC269]/80 text-sm mt-1">Verwalte Budget, Ziele und Integrationen.</p>
          </div>
          {settings.hasOnboarded && (
            <button onClick={onClose} className="text-white/80 hover:text-white">
                <X className="h-6 w-6" />
            </button>
          )}
        </div>
        
        <div className="p-6 space-y-6">
          {/* Main Goals Section */}
          <div className="space-y-4">
              <h3 className="font-semibold text-[#193000] border-b border-[#8DA736] pb-2">Ziele</h3>
              <div>
                <label className="block text-sm font-medium text-[#193000] mb-2">
                  Jährliches Reisebudget (€)
                </label>
                <div className="relative">
                    <span className="absolute left-3 top-3 text-[#193000]/40">€</span>
                    <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full pl-8 p-3 bg-white text-[#193000] border border-[#8DA736] rounded-lg focus:ring-2 focus:ring-[#527510] focus:border-transparent outline-none"
                    />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#193000] mb-2">
                  Jährliches CO2 Limit (kg)
                </label>
                 <div className="relative">
                    <span className="absolute left-3 top-3 text-[#193000]/40">kg</span>
                    <input
                    type="number"
                    value={co2}
                    onChange={(e) => setCo2(Number(e.target.value))}
                    className="w-full pl-8 p-3 bg-white text-[#193000] border border-[#8DA736] rounded-lg focus:ring-2 focus:ring-[#527510] focus:border-transparent outline-none"
                    />
                </div>
              </div>
          </div>

          {/* Integrations Section */}
          <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-[#8DA736] pb-2 text-[#193000]">
                  <Search className="h-4 w-4 text-[#527510]" />
                  <h3 className="font-semibold">SerpApi (Google Flights)</h3>
              </div>
              <p className="text-xs text-[#193000]/60">
                  Erforderlich für Live-Flugdaten. Erstelle einen kostenlosen Account auf serpapi.com und füge deinen Key hier ein.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-[#193000] mb-1">
                  SerpApi Key
                </label>
                <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-[#193000]/40" />
                    <input
                    type="password"
                    value={serpKey}
                    onChange={(e) => setSerpKey(e.target.value)}
                    placeholder="Dein Api Key..."
                    className="w-full pl-9 p-2 bg-white text-[#193000] border border-[#8DA736] rounded-lg focus:ring-2 focus:ring-[#527510] focus:border-transparent outline-none text-sm"
                    />
                </div>
              </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-[#527510] text-white py-3 rounded-lg font-semibold hover:bg-[#193000] transition-colors shadow-lg shadow-[#8DA736]/30 flex items-center justify-center gap-2"
          >
            <Save className="h-5 w-5" />
            Einstellungen speichern
          </button>
        </div>
      </div>
    </div>
  );
};
