
import React from 'react';
import { LayoutDashboard, MessageCircle, History, Settings, Leaf } from 'lucide-react';
import { View } from '../types';

interface HeaderProps {
  currentView: View;
  setView: (view: View) => void;
}

// Update path to root absolute path to ensure visibility
const KAI_AVATAR_URL = "/my-notion-face-transparent-2.png";

export const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
  const navItems: { id: View; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner', label: 'Kai', icon: MessageCircle },
    { id: 'history', label: 'Meine Reisen', icon: History },
  ];

  return (
    <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-[#8DA736] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="bg-[#527510] p-2 rounded-lg mr-3 shadow-sm">
              <Leaf className="h-6 w-6 text-[#BFC269]" />
            </div>
            <span className="text-xl font-bold text-[#193000] tracking-tight">EcoTravel</span>
          </div>

          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  currentView === item.id
                    ? 'text-[#193000] bg-[#BFC269]'
                    : 'text-[#193000]/70 hover:text-[#527510] hover:bg-[#8DA736]/30'
                }`}
              >
                {item.id === 'planner' ? (
                  <div className="h-6 w-6 mr-2 rounded-full bg-[#BFC269] border border-[#8DA736] flex items-center justify-center overflow-hidden">
                      <img 
                        src={KAI_AVATAR_URL} 
                        alt="Kai" 
                        className="h-full w-full object-cover object-top" 
                        onError={(e) => {
                          // Fallback in case local image fails
                          (e.target as HTMLImageElement).src = "https://api.dicebear.com/9.x/micah/svg?seed=Daisy&backgroundColor=transparent";
                        }}
                      />
                  </div>
                ) : (
                  <item.icon className="h-4 w-4 mr-2" />
                )}
                {item.label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setView('settings')}
            className="p-2 text-[#193000]/50 hover:text-[#527510] transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-6 w-6" />
          </button>
        </div>
      </div>
      {/* Mobile Nav */}
      <div className="md:hidden border-t border-[#8DA736] bg-white flex justify-around p-2">
         {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center px-3 py-2 rounded-md text-xs font-medium ${
                  currentView === item.id
                    ? 'text-[#527510]'
                    : 'text-[#193000]/60'
                }`}
              >
                {item.id === 'planner' ? (
                   <div className="h-5 w-5 mb-1 rounded-full bg-[#BFC269] border border-[#8DA736] flex items-center justify-center overflow-hidden">
                      <img 
                        src={KAI_AVATAR_URL} 
                        alt="Kai" 
                        className="h-full w-full object-cover object-top" 
                         onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://api.dicebear.com/9.x/micah/svg?seed=Daisy&backgroundColor=transparent";
                        }}
                      />
                   </div>
                ) : (
                  <item.icon className="h-5 w-5 mb-1" />
                )}
                {item.label}
              </button>
            ))}
      </div>
    </header>
  );
};
