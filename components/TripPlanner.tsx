
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Check, Loader2, PlusCircle, Users, Calendar, MapPin, Globe, Minus, Plus, PiggyBank, Clock, ArrowRight, Leaf, Train, Plane, Car, Ship } from 'lucide-react';
import { ChatMessage, Trip, UserSettings, GroundingSource, Recommendation } from '../types';
import { createTravelChat, parseTripFromChat } from '../services/geminiService';
import { Chat } from '@google/genai';

interface TripPlannerProps {
  userSettings: UserSettings;
  currentTrips: Trip[];
  addTrip: (trip: Trip) => void;
}

type ActiveWidget = 'none' | 'personCount' | 'tripDetails';

export const TripPlanner: React.FC<TripPlannerProps> = ({ userSettings, currentTrips, addTrip }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [proposedTrip, setProposedTrip] = useState<Partial<Trip> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  
  // Widget State
  const [activeWidget, setActiveWidget] = useState<ActiveWidget>('none');
  const [pendingFunctionCall, setPendingFunctionCall] = useState<{name: string, id: string} | null>(null);

  // Form States
  const [personCount, setPersonCount] = useState(1);
  
  const [tripDetails, setTripDetails] = useState({
    destination: '',
    tripBudget: '', 
    isFlexible: false,
    startDate: '',
    endDate: '',
    durationDays: '7', 
    preferredSeason: '' 
  });

  useEffect(() => {
    if (!chatSession) {
      const session = createTravelChat(userSettings, currentTrips);
      setChatSession(session);
      handleSendMessage("Hallo! Ich möchte eine neue Reise planen.", session, true);
    }
  }, [chatSession, userSettings, currentTrips]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeWidget]);

  const handleSendMessage = async (text: string | null, session: Chat | null = chatSession, hidden: boolean = false, toolResponse?: any) => {
    if (!session) return;

    let responsePromise;

    if (toolResponse) {
       setActiveWidget('none');
       setPendingFunctionCall(null);
       setIsLoading(true);
       
       const part = {
         functionResponse: {
            name: toolResponse.name,
            response: { result: toolResponse.response }
         }
       };
       responsePromise = session.sendMessage({ message: [part] });

       let confirmationText = "Details gesendet.";
       if (toolResponse.name === 'requestPersonCount') confirmationText = `${toolResponse.response.count} Reisende ausgewählt.`;
       if (toolResponse.name === 'requestTripDetails') {
           const details = toolResponse.response;
           const dest = details.destination ? details.destination : "Inspiration (offen)";
           const budget = details.tripBudget ? `, Budget: ${details.tripBudget}€` : '';
           const time = details.isFlexible ? `ca. ${details.durationDays} Tage (${details.preferredSeason || 'Zeitraum flexibel'})` : `${details.startDate} - ${details.endDate}`;
           confirmationText = `Suche: ${dest} | ${time}${budget}`;
       }
       
       // Don't add user confirmation for displayRecommendations internal loop
       if (toolResponse.name !== 'displayRecommendations') {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                text: confirmationText,
                timestamp: Date.now()
            }]);
       }

    } else if (text) {
        if (!hidden) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                text: text,
                timestamp: Date.now()
            }]);
        }
        setInput('');
        setIsLoading(true);
        setProposedTrip(null); 
        setGroundingSources([]);
        responsePromise = session.sendMessage({ message: text });
    } else {
        return;
    }

    try {
      const result = await responsePromise;
      const responseText = result.text;

      const functionCalls = result.functionCalls || result.candidates?.[0]?.content?.parts?.filter(p => p.functionCall)?.map(p => p.functionCall);
      
      if (functionCalls && functionCalls.length > 0) {
        const fc = functionCalls[0];
        if (fc && fc.name) {
            setPendingFunctionCall({ name: fc.name, id: fc.id || 'unknown' });

            if (fc.name === 'requestPersonCount') {
                setActiveWidget('personCount');
                if (responseText) setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: responseText, timestamp: Date.now() }]);
                setIsLoading(false);
                return;
            } else if (fc.name === 'requestTripDetails') {
                setActiveWidget('tripDetails');
                if (responseText) setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: responseText, timestamp: Date.now() }]);
                setIsLoading(false);
                return;
            } else if (fc.name === 'displayRecommendations') {
                // Handle the recommendations tool
                const args = fc.args as any;
                if (args && args.recommendations) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'model',
                        text: responseText || "Ich habe folgende Optionen für dich gefunden:",
                        recommendations: args.recommendations,
                        timestamp: Date.now()
                    }]);
                    
                    // Automatically respond to the tool call to keep history clean
                    handleSendMessage(null, session, true, {
                        name: fc.name,
                        response: "options_displayed"
                    });
                    return; // Don't execute the rest (parsing trip) yet
                }
            }
        }
      }

      if (responseText) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: responseText,
            timestamp: Date.now()
          }]);
      }

      const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources: GroundingSource[] = [];
      if (chunks) {
        chunks.forEach((chunk: any) => {
            if (chunk.web?.uri && chunk.web?.title) {
                sources.push({ title: chunk.web.title, uri: chunk.web.uri });
            }
        });
      }
      setGroundingSources(sources);

      const fullHistory = messages.map(m => `${m.role}: ${m.text}`).join('\n') + `\nuser: ${text || 'tool_response'}\nmodel: ${responseText}`;
      if (fullHistory.length > 500 && !activeWidget) {
          parseTripFromChat(fullHistory).then(extractedTrip => {
            if (extractedTrip && extractedTrip.destination) {
                setProposedTrip(extractedTrip);
            }
          });
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
        timestamp: Date.now()
      }]);
    } finally {
       setIsLoading(false);
    }
  };

  const handleSelectRecommendation = (rec: Recommendation) => {
      // Set as proposed trip immediately
      const newTrip: Partial<Trip> = {
          destination: rec.destination,
          estimatedCost: rec.estimatedCost,
          estimatedCo2: rec.estimatedCo2,
          transportMode: rec.transportMode,
          notes: rec.description
      };
      setProposedTrip(newTrip);
      handleSendMessage(`Ich wähle die Option: ${rec.title}`, chatSession, false);
  };

  const handleAcceptTrip = () => {
    if (proposedTrip) {
      const newTrip: Trip = {
        id: Date.now().toString(),
        destination: proposedTrip.destination || 'Unbekannt',
        startDate: proposedTrip.startDate || 'TBD',
        endDate: proposedTrip.endDate || 'TBD',
        estimatedCost: proposedTrip.estimatedCost || 0,
        estimatedCo2: proposedTrip.estimatedCo2 || 0,
        status: 'planned',
        notes: proposedTrip.notes || '',
        transportMode: proposedTrip.transportMode
      };
      addTrip(newTrip);
      setProposedTrip(null);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `✅ Die Reise nach **${newTrip.destination}** wurde erfolgreich geplant!`,
        timestamp: Date.now()
      }]);
    }
  };

  const submitPersonCount = () => {
      if (pendingFunctionCall) {
          handleSendMessage(null, chatSession, false, {
              name: pendingFunctionCall.name,
              response: { count: personCount }
          });
      }
  };

  const submitTripDetails = () => {
      if (pendingFunctionCall) {
          handleSendMessage(null, chatSession, false, {
              name: pendingFunctionCall.name,
              response: tripDetails
          });
      }
  };

  const TransportIcon = ({ mode }: { mode: string }) => {
    const m = mode.toLowerCase();
    if (m.includes('flug') || m.includes('flight') || m.includes('plane')) return <Plane className="h-4 w-4 text-blue-500" />;
    if (m.includes('bahn') || m.includes('zug') || m.includes('train')) return <Train className="h-4 w-4 text-emerald-500" />;
    if (m.includes('schiff') || m.includes('fähr') || m.includes('boat')) return <Ship className="h-4 w-4 text-cyan-500" />;
    return <Car className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-center">
        <div className="flex items-center space-x-2">
           <Bot className="h-5 w-5 text-emerald-600" />
           <span className="font-semibold text-emerald-900">EcoTravel Assistent</span>
        </div>
        <span className="text-xs text-emerald-600 bg-white px-2 py-1 rounded-full border border-emerald-200 hidden sm:inline-block">
            Gemini 2.5 & Search
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
             {/* Bubble */}
             <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                <div className={`flex max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mx-2 ${msg.role === 'user' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                        {msg.role === 'user' ? <User className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
                    </div>
                    
                    <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                            ? 'bg-emerald-600 text-white rounded-tr-none'
                            : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                        }`}>
                        {msg.text.split('\n').map((line, i) => (
                            <p key={i} className={line.startsWith('-') ? 'ml-4' : 'mb-1'}>
                                {line.split('**').map((part, j) => 
                                    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                                )}
                            </p>
                        ))}
                    </div>
                </div>
             </div>

             {/* Render Recommendations Cards if present */}
             {msg.recommendations && (
                 <div className="ml-12 w-full max-w-[90%] overflow-x-auto pb-4">
                     <div className="flex space-x-4">
                         {msg.recommendations.map((rec, idx) => (
                             <div key={idx} className="flex-shrink-0 w-72 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col">
                                 <div className="h-40 w-full bg-gray-200 relative">
                                     <img 
                                        src={`https://image.pollinations.ai/prompt/${encodeURIComponent(rec.imageKeyword)}%20travel%20scenery?width=400&height=300&nologo=true`}
                                        alt={rec.destination}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                     />
                                     <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                                        <h4 className="text-white font-bold text-lg leading-tight shadow-sm">{rec.title}</h4>
                                     </div>
                                 </div>
                                 <div className="p-4 flex-1 flex flex-col">
                                     <div className="flex items-center text-xs text-gray-500 mb-2 space-x-2">
                                         <MapPin className="h-3 w-3" />
                                         <span>{rec.destination}</span>
                                     </div>
                                     <p className="text-sm text-gray-600 mb-4 flex-1">{rec.description}</p>
                                     
                                     <div className="grid grid-cols-2 gap-2 mb-4 bg-gray-50 p-2 rounded-lg">
                                         <div className="text-center">
                                             <span className="block text-xs text-gray-400 uppercase">Preis p.P.</span>
                                             <span className="block font-bold text-emerald-600">{rec.estimatedCost} €</span>
                                         </div>
                                         <div className="text-center border-l border-gray-200">
                                             <span className="block text-xs text-gray-400 uppercase">CO2</span>
                                             <div className="flex items-center justify-center gap-1">
                                                 <Leaf className="h-3 w-3 text-emerald-500" />
                                                 <span className="font-bold text-slate-600">{rec.estimatedCo2} kg</span>
                                             </div>
                                         </div>
                                     </div>

                                     <div className="flex justify-between items-center">
                                         <div className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded">
                                             <TransportIcon mode={rec.transportMode} />
                                             <span>{rec.transportMode}</span>
                                         </div>
                                         <button 
                                            onClick={() => handleSelectRecommendation(rec)}
                                            className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center"
                                         >
                                             Auswählen <ArrowRight className="h-4 w-4 ml-1" />
                                         </button>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}
          </div>
        ))}
        
        {groundingSources.length > 0 && !isLoading && !activeWidget && messages[messages.length - 1]?.role === 'model' && (
             <div className="ml-12 mb-4 text-xs text-gray-500 animate-in fade-in">
                <p className="font-semibold mb-1">Quellen:</p>
                <div className="flex flex-wrap gap-2">
                    {groundingSources.map((source, idx) => (
                        <a 
                            key={idx} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center bg-white border border-gray-200 px-2 py-1 rounded hover:bg-gray-50 transition-colors text-blue-600"
                        >
                            <Globe className="h-3 w-3 mr-1" />
                            {source.title}
                        </a>
                    ))}
                </div>
             </div>
        )}

        {isLoading && !activeWidget && (
          <div className="flex justify-start animate-in fade-in">
             <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm ml-12 flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span className="text-sm text-gray-500">Suche nach den besten Optionen...</span>
             </div>
          </div>
        )}

        {/* --- WIDGETS AREA --- */}
        
        {activeWidget === 'personCount' && (
            <div className="flex justify-center my-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="bg-white border-2 border-indigo-100 rounded-xl p-6 shadow-lg max-w-sm w-full text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-indigo-100 p-3 rounded-full">
                            <Users className="h-8 w-8 text-indigo-600" />
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Wie viele Personen reisen?</h3>
                    
                    <div className="flex items-center justify-center space-x-6 my-6">
                        <button 
                            onClick={() => setPersonCount(Math.max(1, personCount - 1))}
                            className="p-3 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
                        >
                            <Minus className="h-6 w-6" />
                        </button>
                        <span className="text-4xl font-bold text-indigo-600 w-16">{personCount}</span>
                        <button 
                            onClick={() => setPersonCount(personCount + 1)}
                            className="p-3 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
                        >
                            <Plus className="h-6 w-6" />
                        </button>
                    </div>

                    <button 
                        onClick={submitPersonCount}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md shadow-indigo-200"
                    >
                        Bestätigen
                    </button>
                </div>
            </div>
        )}

        {activeWidget === 'tripDetails' && (
            <div className="flex justify-center my-4 animate-in slide-in-from-bottom-4 fade-in duration-300 w-full px-2 md:px-0">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xl max-w-md w-full">
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                        <Globe className="h-6 w-6 text-emerald-600" />
                        <h3 className="text-xl font-bold text-gray-800">Reise Eckdaten</h3>
                    </div>

                    <div className="space-y-4">
                        {/* Destination */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Reiseziel oder Region (Optional)</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="z.B. Italien, 'Süden' oder offen lassen"
                                    className="w-full pl-10 p-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                                    value={tripDetails.destination}
                                    onChange={(e) => setTripDetails({...tripDetails, destination: e.target.value})}
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Leer lassen für Inspiration basierend auf Budget & Zeit.</p>
                        </div>

                         {/* Budget for this Trip */}
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Budget für diese Reise (Optional)</label>
                            <div className="relative">
                                <PiggyBank className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input 
                                    type="number" 
                                    placeholder="z.B. 1000"
                                    className="w-full pl-10 p-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                                    value={tripDetails.tripBudget}
                                    onChange={(e) => setTripDetails({...tripDetails, tripBudget: e.target.value})}
                                />
                                <span className="absolute right-3 top-3 text-gray-400">€</span>
                            </div>
                        </div>

                        {/* Dates Logic */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700">Reisezeit</label>
                                <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg">
                                    <input 
                                        type="checkbox" 
                                        id="flexDates"
                                        checked={tripDetails.isFlexible}
                                        onChange={(e) => setTripDetails({...tripDetails, isFlexible: e.target.checked})}
                                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300 bg-white"
                                    />
                                    <label htmlFor="flexDates" className="text-xs text-gray-600 cursor-pointer font-medium">Ich bin flexibel</label>
                                </div>
                            </div>

                            {tripDetails.isFlexible ? (
                                <div className="space-y-3 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                                    <div>
                                        <label className="block text-xs font-medium text-emerald-800 mb-1">Ungefähre Dauer (Tage)</label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600" />
                                            <input 
                                                type="number"
                                                placeholder="z.B. 7"
                                                className="w-full pl-9 p-2 bg-white text-gray-900 border border-emerald-200 rounded-md text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                                value={tripDetails.durationDays}
                                                onChange={(e) => setTripDetails({...tripDetails, durationDays: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-emerald-800 mb-1">Bevorzugter Zeitraum</label>
                                        <input 
                                            type="text"
                                            placeholder="z.B. September, Sommer, egal..."
                                            className="w-full p-2 bg-white text-gray-900 border border-emerald-200 rounded-md text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                            value={tripDetails.preferredSeason}
                                            onChange={(e) => setTripDetails({...tripDetails, preferredSeason: e.target.value})}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="relative">
                                        <input 
                                            type="date" 
                                            className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={tripDetails.startDate}
                                            onChange={(e) => setTripDetails({...tripDetails, startDate: e.target.value})}
                                        />
                                        <span className="text-[10px] text-gray-400 ml-1">Hinreise</span>
                                    </div>
                                    <div className="relative">
                                         <input 
                                            type="date" 
                                            className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={tripDetails.endDate}
                                            onChange={(e) => setTripDetails({...tripDetails, endDate: e.target.value})}
                                        />
                                        <span className="text-[10px] text-gray-400 ml-1">Rückreise</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={submitTripDetails}
                            className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
                        >
                            <Check className="h-5 w-5" />
                            Suche starten
                        </button>
                    </div>
                </div>
            </div>
        )}

        {proposedTrip && !isLoading && !activeWidget && (
            <div className="flex justify-center my-4">
                <div className="bg-white border-2 border-emerald-500 rounded-xl p-5 shadow-lg max-w-md w-full animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Bestätigung der Reise</h3>
                        <PlusCircle className="text-emerald-500 h-6 w-6" />
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-gray-500">Ziel:</span>
                            <span className="font-semibold">{proposedTrip.destination}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-gray-500">Geschätzte Kosten:</span>
                            <span className="font-semibold text-emerald-600">{proposedTrip.estimatedCost} €</span>
                        </div>
                         <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-gray-500">CO2 Fußabdruck:</span>
                            <span className="font-semibold text-slate-600">{proposedTrip.estimatedCo2} kg</span>
                        </div>
                        <div className="flex justify-between pb-2">
                            <span className="text-gray-500">Transport:</span>
                            <span className="font-semibold">{proposedTrip.transportMode}</span>
                        </div>
                        {proposedTrip.notes && (
                            <div className="bg-emerald-50 p-2 rounded text-xs text-emerald-800 italic">
                                {proposedTrip.notes}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={handleAcceptTrip}
                        className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Check className="h-4 w-4" />
                        Reise speichern
                    </button>
                </div>
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={`p-4 bg-white border-t border-gray-200 transition-all duration-300 ${activeWidget !== 'none' ? 'opacity-50 pointer-events-none filter blur-[1px]' : 'opacity-100'}`}>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
            placeholder="Schreibe eine Nachricht..."
            className="flex-1 p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={isLoading || activeWidget !== 'none'}
          />
          <button
            onClick={() => handleSendMessage(input)}
            disabled={isLoading || !input.trim() || activeWidget !== 'none'}
            className={`p-3 rounded-xl transition-colors ${
              isLoading || !input.trim() || activeWidget !== 'none'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
            }`}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
