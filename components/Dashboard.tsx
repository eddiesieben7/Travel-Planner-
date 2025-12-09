
import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Trip, UserSettings } from '../types';
import { Settings, Bookmark, Leaf, Train, Plane, Car, History } from 'lucide-react';

interface DashboardProps {
  userSettings: UserSettings;
  trips: Trip[];
  onEditLimits?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ userSettings, trips, onEditLimits }) => {
  const [activeTab, setActiveTab] = useState<'impact' | 'history'>('impact');

  const totalSpent = trips.reduce((acc, trip) => acc + trip.estimatedCost, 0);
  const totalCo2 = trips.reduce((acc, trip) => acc + trip.estimatedCo2, 0);

  const budgetProgress = Math.min(100, (totalSpent / userSettings.annualBudget) * 100);
  const co2Progress = Math.min(100, (totalCo2 / userSettings.annualCo2Limit) * 100);

  // Data for Donut Charts
  const budgetChartData = [
    { name: 'Spent', value: totalSpent },
    { name: 'Remaining', value: Math.max(0, userSettings.annualBudget - totalSpent) },
  ];
  const co2ChartData = [
    { name: 'Used', value: totalCo2 },
    { name: 'Remaining', value: Math.max(0, userSettings.annualCo2Limit - totalCo2) },
  ];

  // Colors based on new palette
  const CO2_COLORS = ['#527510', '#BFC269']; // Dark Green (Used), Light Olive (Remaining)
  const BUDGET_COLORS = ['#3D5901', '#BFC269']; // Forest Green (Spent), Light Olive (Remaining)

  const savedTrips = trips.filter(t => t.status === 'planned');
  const bookedTrips = trips.filter(t => t.status === 'booked' || t.status === 'completed');

  const TransportIcon = ({ mode }: { mode?: string }) => {
      const m = mode?.toLowerCase() || '';
      if (m.includes('flug') || m.includes('flight')) return <Plane className="h-4 w-4" />;
      if (m.includes('bahn') || m.includes('zug') || m.includes('train')) return <Train className="h-4 w-4" />;
      return <Car className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Welcome & Tabs Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#8DA736] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-[#193000]">Willkommen zurück, Alex</h1>
            <p className="text-[#193000]/60 text-sm mt-1">Verwalte deine Nachhaltigkeitsziele und Reisehistorie.</p>
        </div>
        <div className="flex bg-[#8DA736]/20 p-1 rounded-lg border border-[#8DA736]">
            <button 
                onClick={() => setActiveTab('impact')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'impact' ? 'bg-[#527510] text-white shadow-sm' : 'text-[#193000]/60 hover:text-[#527510]'}`}
            >
                Mein Einfluss
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-[#527510] text-white shadow-sm' : 'text-[#193000]/60 hover:text-[#527510]'}`}
            >
                Suchverlauf
            </button>
        </div>
      </div>

      {activeTab === 'impact' && (
          <>
            {/* Edit Limits Link */}
            <div className="flex justify-end">
                <button onClick={onEditLimits} className="flex items-center text-sm text-[#193000]/60 hover:text-[#527510] transition-colors">
                    <Settings className="h-4 w-4 mr-1" />
                    Limits bearbeiten
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CO2 Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#8DA736] relative">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                            <Leaf className="h-5 w-5 text-[#527510]" />
                            <h3 className="font-semibold text-[#193000]">CO₂ Fußabdruck</h3>
                        </div>
                        <span className="bg-[#8DA736]/30 text-[#527510] text-xs px-2 py-1 rounded-full font-medium">jährlich</span>
                    </div>

                    <div className="flex flex-col items-center justify-center relative h-48">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={co2ChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {co2ChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CO2_COLORS[index]} />
                                    ))}
                                </Pie>
                            </PieChart>
                         </ResponsiveContainer>
                         <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                             <span className="text-2xl font-bold text-[#193000]">{totalCo2}</span>
                             <span className="text-xs text-[#193000]/60">kg verbraucht</span>
                         </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#193000]/60">Fortschritt:</span>
                            <span className="font-medium text-[#527510]">{co2Progress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-[#BFC269] rounded-full h-2">
                            <div className="bg-[#527510] h-2 rounded-full transition-all duration-1000" style={{ width: `${co2Progress}%` }}></div>
                        </div>
                        <p className="text-xs text-center text-[#193000]/40 mt-2">Limit: {userSettings.annualCo2Limit} kg</p>
                    </div>
                </div>

                {/* Budget Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#8DA736] relative">
                     <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                            <History className="h-5 w-5 text-[#3D5901]" />
                            <h3 className="font-semibold text-[#193000]">Reisebudget</h3>
                        </div>
                        <span className="bg-[#8DA736]/30 text-[#193000] text-xs px-2 py-1 rounded-full font-medium">jährlich</span>
                    </div>

                     <div className="flex flex-col items-center justify-center relative h-48">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={budgetChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {budgetChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={BUDGET_COLORS[index]} />
                                    ))}
                                </Pie>
                            </PieChart>
                         </ResponsiveContainer>
                         <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                             <span className="text-2xl font-bold text-[#193000]">€{totalSpent}</span>
                             <span className="text-xs text-[#193000]/60">ausgegeben</span>
                         </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#193000]/60">Fortschritt:</span>
                            <span className="font-medium text-[#3D5901]">{budgetProgress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-[#BFC269] rounded-full h-2">
                            <div className="bg-[#3D5901] h-2 rounded-full transition-all duration-1000" style={{ width: `${budgetProgress}%` }}></div>
                        </div>
                        <p className="text-xs text-center text-[#193000]/40 mt-2">Limit: €{userSettings.annualBudget}</p>
                    </div>
                </div>
            </div>

            {/* Saved Trips Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#8DA736]">
                <div className="flex items-center gap-2 mb-4">
                    <Bookmark className="h-5 w-5 text-[#527510]" />
                    <h3 className="font-bold text-[#193000]">Gespeicherte Reisen</h3>
                </div>
                
                {savedTrips.length === 0 ? (
                    <div className="text-center py-8 text-[#193000]/40 text-sm">
                        Noch keine Reisen gespeichert. Klicke im Chat auf "Reise wählen", um eine Reise zu merken.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {savedTrips.map(trip => (
                            <div key={trip.id} className="border border-[#8DA736] rounded-xl p-4 hover:shadow-md transition-shadow flex justify-between items-center bg-[#FAFAFA]">
                                <div>
                                    <h4 className="font-bold text-[#193000]">{trip.destination}</h4>
                                    <p className="text-sm text-[#193000]/60">{trip.startDate === 'TBD' ? 'Datum offen' : `${trip.startDate} - ${trip.endDate}`}</p>
                                    {trip.notes && <p className="text-xs text-[#193000]/40 mt-1 italic">"{trip.notes}"</p>}
                                </div>
                                <div className="text-right">
                                    <div className="font-medium text-[#193000]">{trip.estimatedCost} €</div>
                                    <div className="text-xs text-[#527510]">{trip.estimatedCo2} kg CO₂</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Booking History Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#8DA736]">
                 <div className="flex items-center gap-2 mb-4">
                    <History className="h-5 w-5 text-[#193000]" />
                    <h3 className="font-bold text-[#193000]">Buchungshistorie</h3>
                </div>

                {bookedTrips.length === 0 ? (
                    <div className="text-center py-4 text-[#193000]/40 text-sm">
                        Keine abgeschlossenen Buchungen.
                    </div>
                ) : (
                     <div className="space-y-4">
                        {bookedTrips.map(trip => (
                            <div key={trip.id} className="flex justify-between items-center py-2 border-b border-[#8DA736] last:border-0">
                                <div>
                                    <h4 className="font-bold text-[#193000] text-sm">{trip.destination}</h4>
                                    <div className="flex items-center text-xs text-[#193000]/50 mt-1 gap-2">
                                        <span>{new Date(trip.startDate).toLocaleDateString('de-DE')}</span>
                                        <span>•</span>
                                        <div className="flex items-center gap-1">
                                            <TransportIcon mode={trip.transportMode} />
                                            <span>{trip.transportMode || 'Reise'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center justify-end text-[#527510] text-xs font-medium mb-1">
                                        <Leaf className="h-3 w-3 mr-1" />
                                        {trip.estimatedCo2} kg
                                    </div>
                                    <div className="font-bold text-[#193000] text-sm">{trip.estimatedCost} €</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </>
      )}

      {activeTab === 'history' && (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-[#8DA736]">
              <p className="text-[#193000]/50">Dein Suchverlauf ist leer.</p>
          </div>
      )}

    </div>
  );
};
