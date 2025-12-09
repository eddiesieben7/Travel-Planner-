
export interface UserSettings {
  annualBudget: number;
  annualCo2Limit: number; // in kg
  hasOnboarded: boolean;
  serpApiKey?: string;
}

export interface Trip {
  id: string;
  destination: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  estimatedCost: number;
  estimatedCo2: number;
  status: 'planned' | 'booked' | 'completed';
  notes: string;
  transportMode?: string;
}

export interface Recommendation {
  title: string;
  destination: string;
  description: string;
  estimatedCost: number; // Total sum
  estimatedCo2: number;
  transportMode: string;
  imageKeyword: string; // For finding an image
  // New fields for separated pricing and links
  flightPrice?: number;
  accommodationPrice?: number;
  flightLink?: string;
  accommodationLink?: string;
  accommodationType?: string; // 'Hotel' | 'Ferienhaus'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  // If the model proposes a concrete trip structure, it comes here
  proposedTrip?: Partial<Trip>;
  // If the model returns structured recommendations
  recommendations?: Recommendation[];
  // If true, this is a system log/thought process message
  isAction?: boolean;
}

export type View = 'dashboard' | 'planner' | 'history' | 'settings';

export interface GroundingSource {
    title: string;
    uri: string;
}
