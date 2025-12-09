import { GoogleGenAI, Type, Chat, FunctionDeclaration } from "@google/genai";
import { ChatMessage, Trip, UserSettings } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema for extracting structured trip data from the conversation when finalized
const tripSchema = {
  type: Type.OBJECT,
  properties: {
    destination: { type: Type.STRING, description: "Das Hauptreiseziel" },
    estimatedCost: { type: Type.NUMBER, description: "Geschätzte Gesamtkosten in Euro" },
    estimatedCo2: { type: Type.NUMBER, description: "Geschätzter CO2-Ausstoß in kg" },
    startDate: { type: Type.STRING, description: "Startdatum (YYYY-MM-DD) oder 'TBD' falls noch flexibel" },
    endDate: { type: Type.STRING, description: "Enddatum (YYYY-MM-DD) oder 'TBD' falls noch flexibel" },
    transportMode: { type: Type.STRING, description: "Hauptverkehrsmittel (Flug, Bahn, Auto, etc.)" },
    notes: { type: Type.STRING, description: "Kurze Zusammenfassung der Reise" }
  },
  required: ["destination", "estimatedCost", "estimatedCo2", "transportMode"]
};

// UI Tool Definitions
const requestPersonCountTool: FunctionDeclaration = {
  name: "requestPersonCount",
  description: "Triggers a UI widget for the user to input the number of travelers. Use this whenever you need to know how many people are traveling.",
};

const requestTripDetailsTool: FunctionDeclaration = {
  name: "requestTripDetails",
  description: "Triggers a detailed search form UI. Use this when the user wants to search for trips, even if the destination is vague (e.g., 'inspiration') or dates are flexible.",
};

const displayRecommendationsTool: FunctionDeclaration = {
  name: "displayRecommendations",
  description: "Displays a list of visual trip cards to the user. Use this ONLY when you have found concrete travel options (Phase 4) and want to present them.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      recommendations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Kurzer, knackiger Titel (z.B. 'Zugreise in die Toskana')" },
            destination: { type: Type.STRING, description: "Ort/Region" },
            description: { type: Type.STRING, description: "1-2 Sätze warum das toll ist." },
            estimatedCost: { type: Type.NUMBER, description: "GESAMT-Preis pro Person in EUR (Summe aus Flug + Hotel)" },
            estimatedCo2: { type: Type.NUMBER, description: "CO2 in kg" },
            transportMode: { type: Type.STRING, description: "Zug, Flug, Auto, Bus" },
            imageKeyword: { type: Type.STRING, description: "Ein englisches Stichwort für die Bildsuche (z.B. 'Tuscany landscape', 'Paris Eiffel Tower')" },
            // New separate fields
            flightPrice: { type: Type.NUMBER, description: "Preis NUR für den Flug/Transport in EUR" },
            accommodationPrice: { type: Type.NUMBER, description: "Preis NUR für die Unterkunft in EUR" },
            flightLink: { type: Type.STRING, description: "Der Deep-Link zur Flugsuche (Google Flights), den du vom Tool erhalten hast." },
            accommodationLink: { type: Type.STRING, description: "Der Deep-Link zur Hotelsuche (Google Travel), den du vom Tool erhalten hast." },
            accommodationType: { type: Type.STRING, description: "Art der Unterkunft: 'Hotel' oder 'Ferienhaus'" }
          },
          required: ["title", "destination", "estimatedCost", "estimatedCo2", "transportMode", "imageKeyword"]
        }
      }
    },
    required: ["recommendations"]
  }
};

// External API Tool Definition (Weather)
const getWeatherTool: FunctionDeclaration = {
  name: "getDestinationWeather",
  description: "Gets the current weather forecast for a destination using an external API. Use this when the user asks about weather, climate, or best time to travel.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      locationName: { type: Type.STRING, description: "Name of the city/region" },
      latitude: { type: Type.NUMBER, description: "Latitude of the destination (approximate is fine)" },
      longitude: { type: Type.NUMBER, description: "Longitude of the destination (approximate is fine)" },
    },
    required: ["locationName", "latitude", "longitude"]
  }
};

// SerpApi Google Flights Search Tool
const searchFlightsTool: FunctionDeclaration = {
  name: "searchFlights",
  description: "Searches for REAL, LIVE flight offers using the Google Flights engine via SerpApi. Use this when the user asks for flight prices or availability.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      origin: { type: Type.STRING, description: "3-letter IATA Airport Code (e.g., 'MUC', 'FRA'). DO NOT use city names." },
      destination: { type: Type.STRING, description: "3-letter IATA Airport Code (e.g., 'LHR', 'JFK'). DO NOT use city names." },
      departureDate: { type: Type.STRING, description: "Date in YYYY-MM-DD format." },
      returnDate: { type: Type.STRING, description: "Optional return date in YYYY-MM-DD format." },
    },
    required: ["origin", "destination", "departureDate"]
  }
};

// SerpApi Google Hotels Search Tool
const searchHotelsTool: FunctionDeclaration = {
  name: "searchHotels",
  description: "Searches for REAL, LIVE hotel or vacation rental offers using the Google Hotels engine via SerpApi. Use this when the user asks for accommodation.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      q: { type: Type.STRING, description: "Location query (e.g. 'Hotels in Paris', 'Berlin'). Can be a city name." },
      check_in_date: { type: Type.STRING, description: "Check-in date in YYYY-MM-DD format." },
      check_out_date: { type: Type.STRING, description: "Check-out date in YYYY-MM-DD format." },
      adults: { type: Type.NUMBER, description: "Number of adults (default is 1)." },
      accommodation_type: { 
        type: Type.STRING, 
        enum: ["hotel", "vacation_rental"], 
        description: "Type of accommodation. Use 'vacation_rental' if user asks for 'Ferienhaus', 'Ferienwohnung', etc." 
      }
    },
    required: ["q", "check_in_date", "check_out_date"]
  }
};

export const createTravelChat = (userSettings: UserSettings, currentTrips: Trip[]): Chat => {
  const model = "gemini-2.5-flash";
  
  const systemInstruction = `
    Du bist "Kai" 🌿, dein persönlicher und sympathischer Reise-Assistent.
    Deine Mission ist es, dem Nutzer kompetent und inspirierend bei der Planung von unvergesslichen Reisen zu helfen und dabei immer das Budget (${userSettings.annualBudget}€) und die Umwelt (${userSettings.annualCo2Limit}kg CO2) im Blick zu haben.
    
    DEIN CHARAKTER (PERSONA):
    - Name: Kai.
    - Tonfall: Freundlich, professionell, hilfsbereit und positiv. Du bist zugänglich für alle Altersgruppen.
    - Ansprache: DUZE den Nutzer immer, aber bleibe dabei respektvoll und nicht zu umgangssprachlich ("Hallo!", "Lass uns deine nächste Reise planen!").
    - Emojis: Nutze sie gezielt, um Informationen aufzulockern, aber nicht übermäßig. ✨🌍✈️🚆
    - Haltung: Du bist ein verlässlicher Assistent, der den Planungsprozess einfach und angenehm macht.

    DEINE ERSTE NACHRICHT:
    - In deiner allerersten Nachricht an den Nutzer, stelle dich kurz vor und stelle eine offene Einstiegsfrage. Zum Beispiel: "Hallo! Ich bin Kai, dein persönlicher Reise-Assistent. Wohin soll die nächste Reise gehen, oder suchst du noch nach Inspiration? 🌍"
    
    Aktueller Status des Nutzers:
    - Budget verbraucht: ${currentTrips.reduce((acc, t) => acc + t.estimatedCost, 0)}€
    - CO2 verbraucht: ${currentTrips.reduce((acc, t) => acc + t.estimatedCo2, 0)}kg

    WICHTIGE REGELN FÜR DEN DIALOG:
    
    PHASE 1: INSPIRATION (Wenn Ziel unklar)
    - Wenn der Nutzer planlos ist ("Weiß nicht wohin"), sei kreativ!
    - "Kein Problem, lass uns herausfinden, worauf du Lust hast."
    - Stelle 2-3 lockere "Entweder-Oder"-Fragen (z.B. "Eher entspannt am Strand 🏖️ oder aktiv in den Bergen 🏔️?", "Kultur in der Stadt erleben 🏛️ oder Natur pur 🌳?").
    
    PHASE 2: DATEN ERFASSUNG (Widget)
    - Sobald eine Richtung klar ist: "Das klingt gut! Lass uns die Details festlegen." -> Rufe \`requestTripDetails\` auf.
    
    PHASE 3: PERSONEN (Widget)
    - Bevor du Preise checkst: "Mit wie vielen Personen planst du die Reise?" -> Rufe \`requestPersonCount\` auf.

    PHASE 4: SUCHE & PRÄSENTATION (Karten & APIs)
    - Nutze \`googleSearch\` für allgemeine Informationen.
    - Nutze \`getDestinationWeather\` für Wetterfragen.
    - Nutze \`searchFlights\` für Flüge (Nur IATA Codes!).
       - WICHTIG: Erkläre dem Nutzer, dass der Link zu Google Flights den aktuellen Live-Preis zeigt.
    - Nutze \`searchHotels\` für Unterkünfte. 
       - Wenn der Nutzer nach "Ferienhaus" oder "Apartment" fragt, setze \`accommodation_type\` auf 'vacation_rental'.
    
    PRÄSENTATION DER ERGEBNISSE:
    - WICHTIG: Wenn du konkrete Optionen gefunden hast (Flug + Hotel), nutze IMMER \`displayRecommendations\`.
    - Fülle dabei UNBEDINGT die Felder \`flightPrice\`, \`accommodationPrice\`, \`flightLink\` und \`accommodationLink\` aus.
    - Nutze exakt die Links, die dir die Tools (searchFlights, searchHotels) zurückgeben. Die App generiert daraus spezielle, funktionierende Links für Google Flights/Travel.
    
    Sei hilfsbereit, kompetent und mach die Reiseplanung zu einem positiven Erlebnis!
  `;

  return ai.chats.create({
    model,
    config: {
      systemInstruction,
      tools: [
        { googleSearch: {} }, 
        { functionDeclarations: [requestPersonCountTool, requestTripDetailsTool, displayRecommendationsTool, getWeatherTool, searchFlightsTool, searchHotelsTool] }
      ],
    },
  });
};

export const parseTripFromChat = async (chatHistory: string): Promise<Partial<Trip> | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Basierend auf dem folgenden Chat-Verlauf, extrahiere die Details der final vereinbarten Reise im JSON-Format. Wenn keine Reise final vereinbart wurde, antwortorte mit NULL.
      
      Chat Verlauf:
      ${chatHistory}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: tripSchema,
      }
    });

    const text = response.text;
    if (!text || text.includes("NULL")) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error("Error parsing trip:", e);
    return null;
  }
};
