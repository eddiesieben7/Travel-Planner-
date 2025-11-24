import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Trip, UserSettings } from '../types';
import { Euro, CloudFog, Plane, Train, Car, MapPin } from 'lucide-react';

interface DashboardProps {
  userSettings: UserSettings;
  trips: Trip[];
}

export const Dashboard: React.FC<DashboardProps> = ({ userSettings, trips }) => {
  const totalSpent = trips.reduce((acc, trip) => acc + trip.estimatedCost, 0);
  const totalCo2 = trips.reduce((acc, trip) => acc + trip.estimatedCo2, 0);

  const budgetData = [
    { name: 'Verplant', value: totalSpent },
    { name: 'Verfügbar', value: Math.max(0, userSettings.annualBudget - totalSpent) },
  ];

  const co2Data = [
    { name: 'Verbraucht', value: totalCo2 },
    { name: 'Verbleibend', value: Math.max(0, userSettings.annualCo2Limit - totalCo2) },
  ];

  const COLORS = {
    budget: ['#10b981', '#e5e7eb'], // emerald-500, gray-200
    co2: ['#64748b', '#e5e7eb'],    // slate-500, gray-200
  };

  const TransportIcon = ({ mode }: { mode?: string }) => {
    const m = mode?.toLowerCase() || '';
    if (m.includes('flug') || m.includes('flight')) return <Plane className="h-4 w-4 text-blue-500" />;
    if (m.includes('bahn') || m.includes('zug') || m.includes('train')) return <Train className="h-4 w-4 text-emerald-500" />;
    return <Car className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-10">
                <Euro className="w-32 h-32" />
            </div>
            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Jahresbudget</h3>
            <div className="mt-2 flex items-baseline">
                <span className="text-4xl font-bold text-gray-900">{totalSpent.toLocaleString('de-DE')} €</span>
                <span className="ml-2 text-sm text-gray-500">von {userSettings.annualBudget.toLocaleString('de-DE')} €</span>
            </div>
            <div className="mt-4 w-full bg-gray-100 rounded-full h-2.5">
                <div 
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (totalSpent / userSettings.annualBudget) * 100)}%` }}
                ></div>
            </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
             <div className="absolute right-0 top-0 p-4 opacity-10">
                <CloudFog className="w-32 h-32" />
            </div>
            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">CO2 Bilanz</h3>
             <div className="mt-2 flex items-baseline">
                <span className="text-4xl font-bold text-gray-900">{totalCo2.toLocaleString('de-DE')} kg</span>
                <span className="ml-2 text-sm text-gray-500">von {userSettings.annualCo2Limit.toLocaleString('de-DE')} kg</span>
            </div>
            <div className="mt-4 w-full bg-gray-100 rounded-full h-2.5">
                <div 
                    className="bg-slate-500 h-2.5 rounded-full transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (totalCo2 / userSettings.annualCo2Limit) * 100)}%` }}
                ></div>
            </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Budget Verteilung</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={budgetData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {budgetData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.budget[index % COLORS.budget.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toLocaleString('de-DE')} €`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
           <h4 className="text-lg font-semibold text-gray-800 mb-4">CO2 Verteilung</h4>
           <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={co2Data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {co2Data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.co2[index % COLORS.co2.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toLocaleString('de-DE')} kg`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Upcoming Trips List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Kommende Reisen</h3>
        </div>
        {trips.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Noch keine Reisen geplant. Starte den Reiseplaner!
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {trips.map((trip) => (
              <li key={trip.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-emerald-100 p-3 rounded-full">
                      <MapPin className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900">{trip.destination}</p>
                      <div className="flex items-center text-sm text-gray-500 space-x-2">
                        <span>{trip.startDate !== 'TBD' ? new Date(trip.startDate).toLocaleDateString('de-DE') : 'Datum offen'}</span>
                        <span>•</span>
                        <TransportIcon mode={trip.transportMode} />
                        <span>{trip.transportMode || 'Reisemittel offen'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{trip.estimatedCost} €</p>
                    <p className="text-sm text-slate-500">{trip.estimatedCo2} kg CO2</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
