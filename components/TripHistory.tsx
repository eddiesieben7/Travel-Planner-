
import React from 'react';
import { Trip } from '../types';
import { CheckCircle2 } from 'lucide-react';

interface TripHistoryProps {
    trips: Trip[];
}

export const TripHistory: React.FC<TripHistoryProps> = ({ trips }) => {
    // For demo purposes, let's assume some trips are 'completed' if the date is in the past, 
    // but here we just list them all as a history view.
    
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-[#193000]">Reisehistorie</h2>
            <div className="grid grid-cols-1 gap-4">
                {trips.length === 0 ? (
                    <p className="text-[#193000]/60">Noch keine Reisen eingetragen.</p>
                ) : (
                    trips.map(trip => (
                        <div key={trip.id} className="bg-white border border-[#8DA736] rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-bold text-[#193000]">{trip.destination}</h3>
                                    <span className="px-2 py-1 bg-[#BFC269] text-[#527510] text-xs rounded-full font-medium uppercase tracking-wide">
                                        {trip.status}
                                    </span>
                                </div>
                                <p className="text-[#193000]/60 text-sm mt-1">
                                    {trip.startDate} bis {trip.endDate}
                                </p>
                                {trip.notes && (
                                    <p className="text-[#193000]/70 mt-2 text-sm italic">
                                        "{trip.notes}"
                                    </p>
                                )}
                            </div>
                            <div className="mt-4 md:mt-0 flex flex-row md:flex-col gap-4 md:gap-1 text-right">
                                <div>
                                    <span className="block text-xs text-[#193000]/40 uppercase">Kosten</span>
                                    <span className="font-semibold text-[#193000]">{trip.estimatedCost} €</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-[#193000]/40 uppercase">CO2</span>
                                    <span className="font-semibold text-[#193000]">{trip.estimatedCo2} kg</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
