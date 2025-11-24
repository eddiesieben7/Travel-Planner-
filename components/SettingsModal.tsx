import React, { useState } from 'react';
import { UserSettings } from '../types';
import { Save, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [budget, setBudget] = useState(settings.annualBudget);
  const [co2, setCo2] = useState(settings.annualCo2Limit);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      ...settings,
      annualBudget: budget,
      annualCo2Limit: co2,
      hasOnboarded: true,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-emerald-600 p-6 text-white flex justify-between items-start">
          <div>
             <h2 className="text-2xl font-bold">Deine Ziele</h2>
             <p className="text-emerald-100 text-sm mt-1">Lege dein Jahresbudget und CO2-Ziel fest.</p>
          </div>
          {settings.hasOnboarded && (
            <button onClick={onClose} className="text-white/80 hover:text-white">
                <X className="h-6 w-6" />
            </button>
          )}
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jährliches Reisebudget (€)
            </label>
            <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">€</span>
                <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full pl-8 p-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
            </div>
            <p className="text-xs text-gray-500 mt-1">Wie viel möchtest du dieses Jahr maximal ausgeben?</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jährliches CO2 Limit (kg)
            </label>
             <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">kg</span>
                <input
                type="number"
                value={co2}
                onChange={(e) => setCo2(Number(e.target.value))}
                className="w-full pl-8 p-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
            </div>
            <p className="text-xs text-gray-500 mt-1">Durchschnitt pro Person pro Jahr: ca. 11.000 kg. Nachhaltiges Ziel: unter 2.000 kg für Reisen.</p>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
          >
            <Save className="h-5 w-5" />
            Einstellungen speichern
          </button>
        </div>
      </div>
    </div>
  );
};