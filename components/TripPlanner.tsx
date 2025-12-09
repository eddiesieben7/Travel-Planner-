
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, User, Users, Check, Minus, Plus, PlusCircle, PiggyBank, Clock, ArrowRight, Leaf, Train, Plane, Building, Home, Globe, Calendar, CloudSun, Sparkles, MapPin, Search, Loader2 } from 'lucide-react';
import { ChatMessage, Trip, UserSettings, GroundingSource, Recommendation } from '../types';
import { createTravelChat, parseTripFromChat } from '../services/geminiService';
import { Chat, GenerateContentStreamResult, GenerateContentResponse } from '@google/genai';

interface TripPlannerProps {
  userSettings: UserSettings;
  currentTrips: Trip[];
  addTrip: (trip: Trip) => void;
}

type ActiveWidget = 'none' | 'personCount' | 'tripDetails';

// Update path to root absolute path to ensure visibility
const KAI_AVATAR_URL = "/my-notion-face-transparent-2.png";

interface QuickAction {
  id: string;
  label: string;
  text: string;
  icon: React.ElementType;
}

export const TripPlanner: React.FC<TripPlannerProps> = ({ userSettings, currentTrips, addTrip }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Kai überlegt gerade...'); 
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
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    durationDays: '7', 
    preferredSeason: '' 
  });

  useEffect(() => {
    // Reset session when key settings change significantly, or init if null
    if (!chatSession) {
      const session = createTravelChat(userSettings, currentTrips);
      setChatSession(session);
      // Friendly initial greeting
      handleSendMessage("Hey Kai! Ich will verreisen! 🌍", session, true);
    }
  }, [userSettings, currentTrips]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeWidget, isLoading, proposedTrip]);

  // Dynamic Quick Actions based on conversation state
  const quickActions = useMemo<QuickAction[]>(() => {
    if (isLoading || activeWidget !== 'none') return [];

    const actions: QuickAction[] = [];

    // Phase 1: Start / Inspiration (Few messages)
    if (messages.length <= 2) {
      actions.push({ id: 'inspire', label: 'Inspiration', text: 'Ich brauche Inspiration! Wohin könnte ich reisen?', icon: Sparkles });
      actions.push({ id: 'budget', label: 'Günstige Ziele', text: 'Zeig mir Reiseziele, die gut in mein Budget passen.', icon: PiggyBank });
      actions.push({ id: 'weekend', label: 'Wochenendtrip', text: 'Ich suche etwas für einen kurzen Wochenendtrip.', icon: Calendar });
    } 
    // Phase 3: Proposal / Negotiation
    else if (proposedTrip) {
      actions.push({ id: 'book', label: 'Jetzt buchen', text: 'Das klingt perfekt, lass uns das buchen!', icon: Check });
      actions.push({ id: 'cheaper', label: 'Geht das günstiger?', text: 'Gibt es vergleichbare Optionen, die etwas günstiger sind?', icon: PiggyBank });
      actions.push({ id: 'train', label: 'Lieber mit Zug', text: 'Können wir schauen, ob man da auch gut mit dem Zug hinkommt?', icon: Train });
    }
    // Phase 2: Planning / Search
    else {
      actions.push({ id: 'weather', label: 'Wetter checken', text: 'Wie ist das Wetter dort normalerweise zu der Zeit?', icon: CloudSun });
      actions.push({ id: 'trains', label: 'Zugverbindung?', text: 'Gibt es gute Zugverbindungen dorthin?', icon: Train });
      actions.push({ id: 'hotels', label: 'Unterkünfte', text: 'Zeig mir mal konkrete Unterkünfte.', icon: Home });
    }

    return actions;
  }, [messages.length, proposedTrip, isLoading, activeWidget]);

  // Retry logic wrapper to handle 429 errors
  const sendWithRetry = async (apiCall: () => Promise<GenerateContentStreamResult>, retries = 3): Promise<GenerateContentStreamResult> => {
    try {
      return await apiCall();
    } catch (error: any) {
       // Check for 429 or similar rate limit errors
       if ((error?.status === 429 || error?.code === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) && retries > 0) {
         console.warn(`Rate limited. Retrying in ${(4-retries)*2}s...`);
         setLoadingText(`Kurze Pause zum Nachdenken... (${retries})`);
         await new Promise(resolve => setTimeout(resolve, (4 - retries) * 2000));
         return sendWithRetry(apiCall, retries - 1);
       }
       throw error;
    }
  };

  const handleSendMessage = async (text: string | null, session: Chat | null = chatSession, hidden: boolean = false, toolResponse?: any) => {
    if (!session) return;

    let responseStreamPromise: Promise<GenerateContentStreamResult>;

    if (toolResponse) {
       setActiveWidget('none');
       setPendingFunctionCall(null);
       setIsLoading(true);
       setLoadingText('Verarbeite deine Antwort...');
       
       const part = {
         functionResponse: {
            name: toolResponse.name,
            response: { result: toolResponse.response }
         }
       };
       // Use retry logic for tool responses too
       responseStreamPromise = sendWithRetry(() => session.sendMessageStream({ message: [part] }));

       let confirmationText = "Daten gesendet.";
       let isSystemAction = false;

       if (toolResponse.name === 'requestPersonCount') confirmationText = `${toolResponse.response.count} Reisende 👥`;
       if (toolResponse.name === 'requestTripDetails') {
           const details = toolResponse.response;
           const dest = details.destination ? details.destination : "Lass uns schauen (Inspiration)";
           const time = details.isFlexible ? `ca. ${details.durationDays} Tage` : `${details.startDate} - ${details.endDate}`;
           confirmationText = `Suche gestartet: ${dest} | ${time}`;
       }
       if (toolResponse.name === 'searchFlights') {
         confirmationText = "Checke Flüge via Google Flights... ✈️";
         isSystemAction = true;
       }
       if (toolResponse.name === 'searchHotels') {
         confirmationText = "Checke Unterkünfte via Google Travel... 🏨";
         isSystemAction = true;
       }
       
       // Don't add user confirmation for internal tool loops if it's just a display action
       if (toolResponse.name !== 'displayRecommendations' && toolResponse.name !== 'getDestinationWeather' && !isSystemAction) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                text: confirmationText,
                timestamp: Date.now()
            }]);
       }
       // Add system log for transparent thought process
       if (isSystemAction) {
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'model',
              text: confirmationText,
              timestamp: Date.now(),
              isAction: true
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
        setLoadingText('Kai schreibt...');
        setProposedTrip(null); 
        setGroundingSources([]);
        // Use retry logic for normal messages
        responseStreamPromise = sendWithRetry(() => session.sendMessageStream({ message: text }));
    } else {
        return;
    }

    try {
      const result = await responseStreamPromise;
      
      // Initialize a new message for streaming content
      const newMessageId = (Date.now() + 1).toString();
      let streamedText = "";
      let collectedFunctionCalls: any[] | undefined;
      let lastChunk: GenerateContentResponse | undefined;
      
      // Only add the message to state if it's NOT a pure function call response (handled later)
      // We'll optimistically add it, but might remove/ignore if empty
      setMessages(prev => [...prev, {
        id: newMessageId,
        role: 'model',
        text: '',
        timestamp: Date.now()
      }]);

      for await (const chunk of result) {
        const chunkAsResponse = chunk as GenerateContentResponse;
        lastChunk = chunkAsResponse; // Keep track of the last received chunk

        const chunkText = chunkAsResponse.text;
        if (chunkText) {
          streamedText += chunkText;
          setMessages(prev => prev.map(msg => 
            msg.id === newMessageId ? { ...msg, text: streamedText } : msg
          ));
        }
        
        // Function calls usually arrive in a single chunk. Capture them when they appear.
        if (chunkAsResponse.functionCalls && chunkAsResponse.functionCalls.length > 0) {
            collectedFunctionCalls = chunkAsResponse.functionCalls;
        }
      }

      // After stream finishes, use the collected data instead of awaiting a final response.
      const functionCalls = collectedFunctionCalls;
      
      // If result was purely a function call with no text, remove the empty message bubble
      if (!streamedText && functionCalls && functionCalls.length > 0) {
        setMessages(prev => prev.filter(msg => msg.id !== newMessageId));
      }

      if (functionCalls && functionCalls.length > 0) {
        const fc = functionCalls[0];
        if (fc && fc.name) {
            setPendingFunctionCall({ name: fc.name, id: fc.id || 'unknown' });

            // Log action for transparency
            const actionText = 
                fc.name === 'requestPersonCount' ? "Frage nach Reisenden..." :
                fc.name === 'requestTripDetails' ? "Frage nach Details..." :
                fc.name === 'searchFlights' ? "Suche nach Flügen..." :
                fc.name === 'searchHotels' ? "Suche nach Unterkünften..." :
                fc.name === 'getDestinationWeather' ? "Prüfe Wetterdaten..." :
                "Verarbeite Anfrage...";

            // Don't duplicate if already logged by toolResponse logic
            if (!toolResponse) {
                 setMessages(prev => [...prev, {
                    id: Date.now().toString() + "_action",
                    role: 'model',
                    text: actionText,
                    timestamp: Date.now(),
                    isAction: true
                }]);
            }

            if (fc.name === 'requestPersonCount') {
                setActiveWidget('personCount');
                setIsLoading(false);
                return;
            } else if (fc.name === 'requestTripDetails') {
                setActiveWidget('tripDetails');
                setIsLoading(false);
                return;
            } else if (fc.name === 'displayRecommendations') {
                setLoadingText('Baue deine Reisekarten... 🎨');
                const args = fc.args as any;
                if (args && args.recommendations) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'model',
                        text: streamedText || "Hier sind ein paar coole Optionen für dich:",
                        recommendations: args.recommendations,
                        timestamp: Date.now()
                    }]);
                    
                    handleSendMessage(null, session, true, {
                        name: fc.name,
                        response: "options_displayed"
                    });
                    return;
                }
            } else if (fc.name === 'getDestinationWeather') {
                setLoadingText('Checke das Wetter... ☀️');
                const args = fc.args as any;
                const lat = args.latitude;
                const lon = args.longitude;
                
                try {
                    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
                    const weatherData = await weatherRes.json();
                    
                    handleSendMessage(null, session, true, {
                        name: fc.name,
                        response: weatherData
                    });
                    return;
                } catch (e) {
                     handleSendMessage(null, session, true, {
                        name: fc.name,
                        response: "Error fetching weather data"
                    });
                    return;
                }
            } else if (fc.name === 'searchHotels') {
                setLoadingText('Suche Unterkünfte...');
                const args = fc.args as any;

                if (!userSettings.serpApiKey) {
                     setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'model',
                        text: "⚠️ Hey, für die Hotelsuche brauche ich deinen **SerpApi Key**. Pack den bitte kurz in die Einstellungen! 🔧",
                        timestamp: Date.now()
                    }]);
                    setIsLoading(false);
                    handleSendMessage(null, session, true, {
                         name: fc.name,
                         response: "ERROR: User has not configured SerpApi key in settings."
                    });
                    return;
                }

                try {
                    let query = args.q;
                    if (args.accommodation_type === 'vacation_rental' && !query.toLowerCase().includes('ferien') && !query.toLowerCase().includes('vacation')) {
                        query = `Ferienhaus ${query}`;
                    }

                    setLoadingText(`Scanne Unterkünfte in ${query}... 🏠`);
                    
                    const params = new URLSearchParams({
                        engine: "google_hotels",
                        q: query,
                        check_in_date: args.check_in_date,
                        check_out_date: args.check_out_date,
                        adults: personCount.toString(),
                        currency: "EUR",
                        hl: "de",
                        gl: "de",
                        api_key: userSettings.serpApiKey
                    });
                    
                    if (args.accommodation_type === 'vacation_rental') {
                         params.append("type", "vacation_rentals");
                    }

                    const serpUrl = `https://serpapi.com/search.json?${params.toString()}`;
                    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(serpUrl)}`;
                    
                    const res = await fetch(proxyUrl);
                    if (!res.ok) throw new Error(`SerpApi Hotels request failed: ${res.status}`);
                    
                    const data = await res.json();
                    if (data.error) throw new Error(`SerpApi Error: ${data.error}`);

                    const properties = data.properties || [];
                    const topProperties = properties.slice(0, 5); 

                    const hotelParams = new URLSearchParams({
                        q: query,
                        check_in_date: args.check_in_date,
                        check_out_date: args.check_out_date,
                        adults: personCount.toString(),
                        currency: 'EUR',
                        gl: 'de',
                        hl: 'de'
                    });
                    const googleTravelUrl = `https://www.google.com/travel/search?${hotelParams.toString()}`;
                    
                    if (topProperties.length === 0) {
                        handleSendMessage(null, session, true, {
                             name: fc.name,
                             response: `Keine Unterkünfte gefunden. Link zur manuellen Suche: ${googleTravelUrl}`
                         });
                         return;
                    }

                    const simplified = topProperties.map((hotel: any) => {
                        return {
                            name: hotel.name,
                            price_per_night: hotel.rate_per_night?.lowest,
                            total_rate: hotel.total_rate?.lowest,
                            rating: hotel.overall_rating,
                            description: hotel.description,
                            type: args.accommodation_type === 'vacation_rental' ? 'Ferienhaus' : 'Hotel',
                            link: googleTravelUrl, 
                            image: hotel.images?.[0]?.thumbnail,
                        };
                    });

                    handleSendMessage(null, session, true, {
                        name: fc.name,
                        response: {
                            accommodations: simplified,
                            deepLink: googleTravelUrl,
                            note: "Each link leads to the main Google Travel search results with all filters correctly applied."
                        }
                    });
                    return;

                } catch (e) {
                     console.error("SerpApi Hotels failed", e);
                     handleSendMessage(null, session, true, {
                        name: fc.name,
                        response: `Error fetching hotels: ${e instanceof Error ? e.message : 'Unknown error'}`
                    });
                    return;
                }

            } else if (fc.name === 'searchFlights') {
                setLoadingText('Verbinde mit Google Flights... 🛫');
                
                const args = fc.args as any;
                
                if (!userSettings.serpApiKey) {
                     setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'model',
                        text: "⚠️ Sorry, für die Flugsuche brauche ich deinen **SerpApi Key** in den Einstellungen. 🔧",
                        timestamp: Date.now()
                    }]);
                    setIsLoading(false);
                    handleSendMessage(null, session, true, {
                         name: fc.name,
                         response: "ERROR: User has not configured SerpApi key in settings."
                    });
                    return;
                }

                try {
                    const origin = args.origin?.toUpperCase() || "";
                    const destination = args.destination?.toUpperCase() || "";
                    const { departureDate, returnDate } = args;

                    const d = new Date();
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const todayStr = `${year}-${month}-${day}`;

                    if (departureDate < todayStr) {
                         handleSendMessage(null, session, true, {
                            name: fc.name,
                            response: `ERROR: The departure date provided (${departureDate}) is in the past. Today is ${todayStr}. Please ask the user for a new date.`
                        });
                        return;
                    }

                    setLoadingText(`Suche Flüge: ${origin} → ${destination} ✈️`);
                    
                    const params = new URLSearchParams({
                        engine: "google_flights",
                        departure_id: origin,
                        arrival_id: destination,
                        outbound_date: departureDate,
                        currency: "EUR",
                        hl: "de", 
                        api_key: userSettings.serpApiKey
                    });

                    if (returnDate) {
                        params.append("return_date", returnDate);
                        params.append("type", "1"); 
                    } else {
                        params.append("type", "2"); 
                    }
                    
                    const serpUrl = `https://serpapi.com/search.json?${params.toString()}`;
                    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(serpUrl)}`;
                    
                    const res = await fetch(proxyUrl);
                    if (!res.ok) {
                        const errText = await res.text();
                         throw new Error(`SerpApi request failed: ${res.status} ${res.statusText} - ${errText}`);
                    }
                    
                    const data = await res.json();
                    
                    if (data.error) {
                         throw new Error(`SerpApi Error: ${data.error}`);
                    }

                    const allFlights = [...(data.best_flights || []), ...(data.other_flights || [])].slice(0, 5);
                    const passengersText = `${personCount} ${personCount > 1 ? 'persons' : 'person'}`;
                    let flightQuery: string;

                    if (returnDate) {
                        flightQuery = `flights from ${origin} to ${destination} from ${departureDate} to ${returnDate} for ${passengersText}`;
                    } else {
                        flightQuery = `flights from ${origin} to ${destination} on ${departureDate} for ${passengersText}`;
                    }
                    const globalDeepLink = `https://www.google.com/travel/flights?hl=de&q=${encodeURIComponent(flightQuery)}`;


                    if (allFlights.length === 0) {
                         handleSendMessage(null, session, true, {
                            name: fc.name,
                            response: `Keine Flüge gefunden. Link zur manuellen Suche: ${globalDeepLink}`
                        });
                        return;
                    }

                    const simplified = allFlights.map((flight: any) => ({
                        price: flight.price,
                        airline: flight.flights?.[0]?.airline || "",
                        co2Emission: flight.carbon_emissions?.this_flight 
                            ? `${Math.round(flight.carbon_emissions.this_flight / 1000)} kg` 
                            : 'Unbekannt',
                        duration: flight.total_duration,
                        departure: flight.flights?.[0]?.departure_airport?.time,
                        arrival: flight.flights?.[flight.flights.length - 1]?.arrival_airport?.time,
                        bookingLink: globalDeepLink
                    }));

                    handleSendMessage(null, session, true, {
                        name: fc.name,
                        response: {
                            flights: simplified,
                            deepLink: globalDeepLink,
                            note: "These are live prices. The link should pre-fill all flight data."
                        }
                    });
                    return;

                } catch (e) {
                     console.error("SerpApi fetch failed", e);
                     const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                     let feedback = "Error fetching flight data via SerpApi. Details: " + errorMessage;
                     if (errorMessage.includes("3-letter code") || errorMessage.includes("departure_id")) {
                         feedback += " HINT: You MUST use uppercase 3-letter IATA airport codes (e.g. MUC, LHR) for origin and destination, not city names.";
                     }
                     handleSendMessage(null, session, true, { name: fc.name, response: feedback });
                    return;
                }
            }
        }
      }

      // Handle Grounding, assuming it's in the last chunk
      const chunks = lastChunk?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources: GroundingSource[] = [];
      if (chunks) {
        chunks.forEach((chunk: any) => {
            if (chunk.web?.uri && chunk.web?.title) {
                sources.push({ title: chunk.web.title, uri: chunk.web.uri });
            }
        });
      }
      setGroundingSources(sources);

      // Check for trip structure
      const fullHistory = messages.map(m => `${m.role}: ${m.text}`).join('\n') + `\nuser: ${text || 'tool_response'}\nmodel: ${streamedText}`;
      if (fullHistory.length > 500 && !activeWidget) {
          parseTripFromChat(fullHistory).then(extractedTrip => {
            if (extractedTrip && extractedTrip.destination) {
                setProposedTrip(extractedTrip);
            }
          });
      }

    } catch (error: any) {
      console.error("Chat error:", error);
      let errorMsg = "Ups, da hat was geklemmt. Probier's bitte nochmal! 🔌";
      if (error?.status === 429 || error?.code === 429) {
          errorMsg = "Ich denke gerade sehr viel nach und brauche eine kleine Pause (Rate Limit). Warte kurz... 🧘";
      }
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: errorMsg,
        timestamp: Date.now()
      }]);
    } finally {
       setIsLoading(false);
       setLoadingText('');
    }
  };

  const handleSelectRecommendation = (rec: Recommendation) => {
      const totalCost = rec.estimatedCost || ((rec.flightPrice || 0) + (rec.accommodationPrice || 0));
      
      const newTrip: Partial<Trip> = {
          destination: rec.destination,
          estimatedCost: totalCost,
          estimatedCo2: rec.estimatedCo2,
          transportMode: rec.transportMode,
          notes: rec.description
      };
      setProposedTrip(newTrip);
      handleSendMessage(`Das sieht super aus! Ich wähle: ${rec.title} 😍`, chatSession, false);
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
        text: `🎉 Juhu! Die Reise nach **${newTrip.destination}** ist gespeichert! Pack schon mal die Koffer! 🧳`,
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

  const handleQuickAction = (action: QuickAction) => {
    handleSendMessage(action.text);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-[#8DA736] overflow-hidden">
      <div className="bg-[#BFC269] p-4 border-b border-[#8DA736] flex justify-between items-center">
        <div className="flex items-center space-x-3">
           <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-white shadow-sm bg-[#BFC269] flex items-center justify-center overflow-hidden">
                  <img 
                    src={KAI_AVATAR_URL} 
                    alt="Kai Avatar" 
                    className="h-full w-full object-cover object-top" 
                     onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://api.dicebear.com/9.x/micah/svg?seed=Daisy&backgroundColor=transparent";
                        }}
                  />
              </div>
              <div className="absolute bottom-0 right-0 h-3 w-3 bg-[#527510] border-2 border-white rounded-full"></div>
           </div>
           <div>
               <h3 className="font-bold text-[#193000] leading-tight">Kai 🌿</h3>
               <span className="text-xs text-[#527510] font-medium">Dein Reise-Buddy</span>
           </div>
        </div>
        <div className="flex items-center gap-2">
             <span className="text-xs text-[#193000]/60 hidden sm:inline-block flex items-center gap-1">
                <CloudSun className="h-3 w-3" /> External APIs
            </span>
            <span className="text-xs text-[#527510] bg-white px-2 py-1 rounded-full border border-[#8DA736] hidden sm:inline-block">
                Gemini 2.5
            </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#FAFAFA]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
             {msg.isAction ? (
                 /* Transparent System Action Log */
                 <div className="w-full flex justify-center animate-in fade-in duration-300">
                     <div className="bg-white/60 backdrop-blur-md border border-[#8DA736]/40 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                        <Loader2 className="h-3 w-3 text-[#527510] animate-spin" />
                        <span className="text-xs font-medium text-[#193000]/70 uppercase tracking-wide">{msg.text}</span>
                     </div>
                 </div>
             ) : (
                /* Standard Chat Message */
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                    <div className={`flex max-w-[90%] md:max-w-[85%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start`}>
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center overflow-hidden ${msg.role === 'user' ? 'bg-[#527510]' : 'bg-[#BFC269] border border-[#8DA736]'}`}>
                            {msg.role === 'user' ? (
                                <User className="h-5 w-5 text-white" />
                            ) : (
                                <img 
                                    src={KAI_AVATAR_URL} 
                                    alt="Kai" 
                                    className="h-full w-full object-cover object-top" 
                                    onError={(e) => {
                                    (e.target as HTMLImageElement).src = "https://api.dicebear.com/9.x/micah/svg?seed=Daisy&backgroundColor=transparent";
                                    }}
                                />
                            )}
                        </div>
                        
                        <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user'
                                ? 'bg-[#527510] text-white rounded-tr-none'
                                : 'bg-white text-[#193000] rounded-tl-none border border-[#8DA736]'
                            }`}>
                            {msg.text.split('\n').map((line, i) => {
                                const parts = line.split(/(\[[^\]]+\]\([^)]+\))/g);
                                return (
                                    <p key={i} className={line.startsWith('-') ? 'ml-4' : 'mb-1'}>
                                        {parts.map((part, j) => {
                                            const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                                            if (match) {
                                                return (
                                                    <a key={j} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-[#527510] hover:text-[#193000] underline font-medium inline-flex items-center">
                                                        {match[1]} <Globe className="w-3 h-3 ml-1" />
                                                    </a>
                                                );
                                            }
                                            return part.split('**').map((subPart, k) => 
                                                k % 2 === 1 ? <strong key={k}>{subPart}</strong> : subPart
                                            );
                                        })}
                                    </p>
                                );
                            })}
                        </div>
                    </div>
                </div>
             )}

             {msg.recommendations && (
                 <div className="ml-12 w-full max-w-[90%] overflow-x-auto pb-4">
                     <div className="flex space-x-4">
                         {msg.recommendations.map((rec, idx) => (
                             <div key={idx} className="flex-shrink-0 w-80 bg-white rounded-xl border border-[#8DA736] shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col">
                                 <div className="h-40 w-full bg-[#8DA736]/20 relative">
                                     <img 
                                        src={`https://image.pollinations.ai/prompt/${encodeURIComponent(rec.imageKeyword)}%20travel%20scenery?width=400&height=300&nologo=true`}
                                        alt={rec.destination}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                     />
                                     <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#193000]/80 to-transparent p-3">
                                        <h4 className="text-white font-bold text-lg leading-tight shadow-sm">{rec.title}</h4>
                                     </div>
                                 </div>
                                 <div className="p-4 flex-1 flex flex-col">
                                     <div className="flex items-center text-xs text-[#193000]/60 mb-2 space-x-2">
                                         <MapPin className="h-3 w-3" />
                                         <span>{rec.destination}</span>
                                     </div>
                                     <p className="text-sm text-[#193000]/80 mb-4 flex-1 line-clamp-2">{rec.description}</p>
                                     
                                     <div className="space-y-2 mb-4">
                                         {rec.flightPrice !== undefined && (
                                            <div className="flex justify-between items-center bg-[#BFC269]/50 p-2 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <Plane className="h-4 w-4 text-[#527510]" />
                                                    <span className="text-xs font-medium text-[#193000]">Flug</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-[#193000]">{rec.flightPrice} €</span>
                                                    {rec.flightLink && (
                                                        <a href={rec.flightLink} target="_blank" rel="noreferrer" className="text-[#527510] hover:text-[#193000]" title="Auf Google Flights buchen">
                                                            <ArrowRight className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                </div>
                                             </div>
                                         )}
                                         
                                         {rec.accommodationPrice !== undefined && (
                                             <div className="flex justify-between items-center bg-[#BFC269]/50 p-2 rounded-lg">
                                                 <div className="flex items-center gap-2">
                                                     {rec.accommodationType === 'Ferienhaus' ? (
                                                         <Home className="h-4 w-4 text-[#8DA736]" />
                                                     ) : (
                                                         <Building className="h-4 w-4 text-[#8DA736]" />
                                                     )}
                                                     <span className="text-xs font-medium text-[#193000]">{rec.accommodationType || 'Hotel'}</span>
                                                 </div>
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-bold text-[#193000]">{rec.accommodationPrice} €</span>
                                                    {rec.accommodationLink && (
                                                        <a href={rec.accommodationLink} target="_blank" rel="noreferrer" className="text-[#8DA736] hover:text-[#193000]" title="Auf Google Travel ansehen">
                                                            <ArrowRight className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                </div>
                                             </div>
                                         )}
                                     </div>

                                     <div className="flex items-center justify-between text-xs text-[#193000]/60 mb-3 px-1">
                                         <span>Gesamt ca.</span>
                                         <div className="flex items-center gap-1">
                                             <Leaf className="h-3 w-3 text-[#527510]" />
                                             <span>{rec.estimatedCo2} kg</span>
                                         </div>
                                     </div>

                                     <button 
                                        onClick={() => handleSelectRecommendation(rec)}
                                        className="w-full text-sm bg-[#527510] hover:bg-[#193000] text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center"
                                     >
                                         Diese Reise wählen <Check className="h-4 w-4 ml-1" />
                                     </button>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}
          </div>
        ))}
        
        {groundingSources.length > 0 && !isLoading && !activeWidget && messages[messages.length - 1]?.role === 'model' && (
             <div className="ml-12 mb-4 text-xs animate-in fade-in">
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-px bg-[#8DA736]/30 flex-1"></div>
                    <span className="text-[#193000]/40 font-semibold uppercase tracking-wider text-[10px]">Geprüfte Quellen</span>
                    <div className="h-px bg-[#8DA736]/30 flex-1"></div>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                    {groundingSources.map((source, idx) => (
                        <a 
                            key={idx} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center bg-white/60 backdrop-blur-sm border border-[#8DA736]/40 px-2 py-1 rounded-md hover:bg-[#BFC269]/30 transition-colors text-[#527510] text-[11px]"
                        >
                            <Globe className="h-3 w-3 mr-1" />
                            {source.title}
                        </a>
                    ))}
                </div>
             </div>
        )}

        {isLoading && !activeWidget && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center space-x-3 ml-2">
                 <div className="h-8 w-8 rounded-full overflow-hidden border border-[#8DA736] bg-[#BFC269]">
                     <img src={KAI_AVATAR_URL} alt="Kai Loading" className="h-full w-full object-cover object-top" onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://api.dicebear.com/9.x/micah/svg?seed=Daisy&backgroundColor=transparent";
                        }} />
                 </div>
                 <div className="bg-white/60 backdrop-blur-md px-4 py-3 rounded-2xl rounded-tl-none border border-[#8DA736]/50 shadow-sm flex items-center gap-3">
                    <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-[#527510] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-[#527510] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-[#527510] rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-sm text-[#193000]/70 font-medium animate-pulse">{loadingText}</span>
                 </div>
             </div>
          </div>
        )}

        {activeWidget === 'personCount' && (
            <div className="flex justify-center my-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="bg-white border-2 border-[#8DA736] rounded-xl p-6 shadow-lg max-w-sm w-full text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-[#BFC269] p-3 rounded-full">
                            <Users className="h-8 w-8 text-[#527510]" />
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-[#193000] mb-2">Wie viele Leute seid ihr? 👯</h3>
                    
                    <div className="flex items-center justify-center space-x-6 my-6">
                        <button 
                            onClick={() => setPersonCount(Math.max(1, personCount - 1))}
                            className="p-3 rounded-full bg-white border border-[#8DA736] hover:bg-[#8DA736]/20 transition-colors text-[#193000]"
                        >
                            <Minus className="h-6 w-6" />
                        </button>
                        <span className="text-4xl font-bold text-[#527510] w-16">{personCount}</span>
                        <button 
                            onClick={() => setPersonCount(personCount + 1)}
                            className="p-3 rounded-full bg-white border border-[#8DA736] hover:bg-[#8DA736]/20 transition-colors text-[#193000]"
                        >
                            <Plus className="h-6 w-6" />
                        </button>
                    </div>

                    <button 
                        onClick={submitPersonCount}
                        className="w-full bg-[#527510] hover:bg-[#193000] text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md shadow-[#8DA736]/30"
                    >
                        Bestätigen
                    </button>
                </div>
            </div>
        )}

        {activeWidget === 'tripDetails' && (
            <div className="flex justify-center my-4 animate-in slide-in-from-bottom-4 fade-in duration-300 w-full px-2 md:px-0">
                <div className="bg-white border border-[#8DA736] rounded-xl p-6 shadow-xl max-w-md w-full">
                    <div className="flex items-center gap-2 mb-6 border-b border-[#8DA736] pb-4">
                        <Globe className="h-6 w-6 text-[#527510]" />
                        <h3 className="text-xl font-bold text-[#193000]">Trip-Details 🗺️</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#193000] mb-1">Wohin soll's gehen? (Optional)</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 h-5 w-5 text-[#193000]/40" />
                                <input 
                                    type="text" 
                                    placeholder="z.B. Italien, 'Süden' oder offen lassen"
                                    className="w-full pl-10 p-3 bg-white text-[#193000] border border-[#8DA736] rounded-lg focus:ring-2 focus:ring-[#527510] focus:border-transparent outline-none"
                                    value={tripDetails.destination}
                                    onChange={(e) => setTripDetails({...tripDetails, destination: e.target.value})}
                                />
                            </div>
                            <p className="text-xs text-[#193000]/40 mt-1">Leer lassen für Überraschungen! ✨</p>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-[#193000] mb-1">Budget für diesen Trip (Optional)</label>
                            <div className="relative">
                                <PiggyBank className="absolute left-3 top-3 h-5 w-5 text-[#193000]/40" />
                                <input 
                                    type="number" 
                                    placeholder="z.B. 1000"
                                    className="w-full pl-10 p-3 bg-white text-[#193000] border border-[#8DA736] rounded-lg focus:ring-2 focus:ring-[#527510] focus:border-transparent outline-none"
                                    value={tripDetails.tripBudget}
                                    onChange={(e) => setTripDetails({...tripDetails, tripBudget: e.target.value})}
                                />
                                <span className="absolute right-3 top-3 text-[#193000]/40">€</span>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-[#193000]">Wann?</label>
                                <div className="flex items-center gap-2 bg-[#8DA736]/20 px-2 py-1 rounded-lg">
                                    <input 
                                        type="checkbox" 
                                        id="flexDates"
                                        checked={tripDetails.isFlexible}
                                        onChange={(e) => setTripDetails({...tripDetails, isFlexible: e.target.checked})}
                                        className="w-4 h-4 text-[#527510] rounded focus:ring-[#527510] border-[#8DA736] bg-white"
                                    />
                                    <label htmlFor="flexDates" className="text-xs text-[#193000] cursor-pointer font-medium">Bin flexibel 📅</label>
                                </div>
                            </div>

                            {tripDetails.isFlexible ? (
                                <div className="space-y-3 bg-[#BFC269]/50 p-3 rounded-lg border border-[#8DA736]/30">
                                    <div>
                                        <label className="block text-xs font-medium text-[#527510] mb-1">Wie viele Tage ca.?</label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-[#527510]" />
                                            <input 
                                                type="number"
                                                placeholder="z.B. 7"
                                                className="w-full pl-9 p-2 bg-white text-[#193000] border border-[#8DA736] rounded-md text-sm focus:ring-1 focus:ring-[#527510] outline-none"
                                                value={tripDetails.durationDays}
                                                onChange={(e) => setTripDetails({...tripDetails, durationDays: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[#527510] mb-1">Jahreszeit / Monat?</label>
                                        <input 
                                            type="text"
                                            placeholder="z.B. September, Sommer..."
                                            className="w-full p-2 bg-white text-[#193000] border border-[#8DA736] rounded-md text-sm focus:ring-1 focus:ring-[#527510] outline-none"
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
                                            className="w-full p-2 bg-white text-[#193000] border border-[#8DA736] rounded-lg text-sm focus:ring-2 focus:ring-[#527510] outline-none"
                                            value={tripDetails.startDate}
                                            onChange={(e) => setTripDetails({...tripDetails, startDate: e.target.value})}
                                        />
                                        <span className="text-[10px] text-[#193000]/40 ml-1">Start</span>
                                    </div>
                                    <div className="relative">
                                         <input 
                                            type="date" 
                                            className="w-full p-2 bg-white text-[#193000] border border-[#8DA736] rounded-lg text-sm focus:ring-2 focus:ring-[#527510] outline-none"
                                            value={tripDetails.endDate}
                                            onChange={(e) => setTripDetails({...tripDetails, endDate: e.target.value})}
                                        />
                                        <span className="text-[10px] text-[#193000]/40 ml-1">Ende</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={submitTripDetails}
                            className="w-full mt-2 bg-[#527510] hover:bg-[#193000] text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md shadow-[#8DA736]/30 flex items-center justify-center gap-2"
                        >
                            <Check className="h-5 w-5" />
                            Kai, such mir was raus! 🚀
                        </button>
                    </div>
                </div>
            </div>
        )}

        {proposedTrip && !isLoading && !activeWidget && (
            <div className="flex justify-center my-4">
                <div className="bg-white border-2 border-[#8DA736] rounded-xl p-5 shadow-lg max-w-md w-full animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-[#193000]">Passt das so? ✅</h3>
                        <PlusCircle className="text-[#527510] h-6 w-6" />
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between border-b border-[#8DA736] pb-2">
                            <span className="text-[#193000]/60">Ziel:</span>
                            <span className="font-semibold text-[#193000]">{proposedTrip.destination}</span>
                        </div>
                        <div className="flex justify-between border-b border-[#8DA736] pb-2">
                            <span className="text-[#193000]/60">Geschätzte Kosten:</span>
                            <span className="font-semibold text-[#527510]">{proposedTrip.estimatedCost} €</span>
                        </div>
                         <div className="flex justify-between border-b border-[#8DA736] pb-2">
                            <span className="text-[#193000]/60">CO2 Fußabdruck:</span>
                            <span className="font-semibold text-[#193000]">{proposedTrip.estimatedCo2} kg</span>
                        </div>
                        <div className="flex justify-between pb-2">
                            <span className="text-[#193000]/60">Transport:</span>
                            <span className="font-semibold text-[#193000]">{proposedTrip.transportMode}</span>
                        </div>
                        {proposedTrip.notes && (
                            <div className="bg-[#BFC269]/50 p-2 rounded text-xs text-[#527510] italic">
                                "{proposedTrip.notes}"
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={handleAcceptTrip}
                        className="w-full mt-4 bg-[#527510] hover:bg-[#193000] text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Check className="h-4 w-4" />
                        Ja, buchen wir ein!
                    </button>
                </div>
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={`p-4 bg-white border-t border-[#8DA736] transition-all duration-300 ${activeWidget !== 'none' ? 'opacity-50 pointer-events-none filter blur-[1px]' : 'opacity-100'}`}>
        {/* Contextual Quick Actions */}
        {quickActions.length > 0 && (
          <div className="flex space-x-2 overflow-x-auto pb-3 scrollbar-hide">
            {quickActions.map(action => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className="flex items-center flex-shrink-0 px-3 py-1.5 bg-[#BFC269] hover:bg-[#8DA736]/30 text-[#193000] text-xs font-medium rounded-full border border-[#8DA736] transition-colors whitespace-nowrap"
              >
                <action.icon className="h-3 w-3 mr-1.5" />
                {action.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
            placeholder="Schreib Kai eine Nachricht..."
            className="flex-1 p-3 bg-white text-[#193000] border border-[#8DA736] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#527510] focus:border-transparent placeholder-[#193000]/40"
            disabled={isLoading || activeWidget !== 'none'}
          />
          <button
            onClick={() => handleSendMessage(input)}
            disabled={isLoading || !input.trim() || activeWidget !== 'none'}
            className={`p-3 rounded-xl transition-colors ${
              isLoading || !input.trim() || activeWidget !== 'none'
                ? 'bg-[#FAFAFA] text-[#193000]/30 cursor-not-allowed'
                : 'bg-[#527510] text-white hover:bg-[#193000] shadow-md'
            }`}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
