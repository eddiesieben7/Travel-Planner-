
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
            estimatedCost: { type: Type.NUMBER, description: "Preis pro Person in EUR" },
            estimatedCo2: { type: Type.NUMBER, description: "CO2 in kg" },
            transportMode: { type: Type.STRING, description: "Zug, Flug, Auto, Bus" },
            imageKeyword: { type: Type.STRING, description: "Ein englisches Stichwort für die Bildsuche (z.B. 'Tuscany landscape', 'Paris Eiffel Tower')" }
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
  description: "Searches for REAL, LIVE hotel offers using the Google Hotels engine via SerpApi. Use this when the user asks for accommodation, hotels, or places to stay.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      q: { type: Type.STRING, description: "Location query (e.g. 'Hotels in Paris', 'Berlin'). Can be a city name." },
      check_in_date: { type: Type.STRING, description: "Check-in date in YYYY-MM-DD format." },
      check_out_date: { type: Type.STRING, description: "Check-out date in YYYY-MM-DD format." },
      adults: { type: Type.NUMBER, description: "Number of adults (default is 1)." }
    },
    required: ["q", "check_in_date", "check_out_date"]
  }
};

export const createTravelChat = (userSettings: UserSettings, currentTrips: Trip[]): Chat => {
  const model = "gemini-2.5-flash";
  
  const systemInstruction = `
    Du bist ein erfahrener, nachhaltiger Reiseplaner und Assistent (EcoTravel Bot).
    Deine Aufgabe ist es, dem Nutzer bei der Planung von Reisen zu helfen und dabei sein Jahresbudget (${userSettings.annualBudget}€) und sein CO2-Ziel (${userSettings.annualCo2Limit}kg) im Auge zu behalten.
    
    Aktueller Status des Nutzers:
    - Budget verbraucht: ${currentTrips.reduce((acc, t) => acc + t.estimatedCost, 0)}€
    - CO2 verbraucht: ${currentTrips.reduce((acc, t) => acc + t.estimatedCo2, 0)}kg

    WICHTIGE REGELN FÜR DEN DIALOG:
    
    PHASE 1: INSPIRATION (Wenn Ziel unklar)
    - Wenn der Nutzer noch kein Ziel hat ("Ich weiß nicht wohin", "Bin offen", "Inspiration"), frage NICHT sofort nach Reisedaten.
    - Stelle stattdessen 2-3 inspirierende "Entweder-Oder"-Fragen, um den Geschmack zu treffen.
    - Frage EINZELN nacheinander.
    
    PHASE 2: DATEN ERFASSUNG (Widget)
    - Sobald eine grobe Richtung klar ist ODER der Nutzer konkret planen will, rufe das Tool \`requestTripDetails\` auf.
    
    PHASE 3: PERSONEN (Widget)
    - Wenn du konkrete Angebote machen willst, aber die Personenanzahl nicht kennst, rufe \`requestPersonCount\` auf.

    PHASE 4: SUCHE & PRÄSENTATION (Karten & APIs)
    - Nutze \`googleSearch\` um allgemeine Infos zu finden.
    - Nutze \`getDestinationWeather\` für Wetterfragen.
    
    FLÜGE (SerpApi):
    - Nutze \`searchFlights\` WENN der Nutzer explizit nach Flügen fragt UND ein API Key vorhanden ist.
    - WICHTIG: Die API akzeptiert NUR 3-stellige IATA-Flughafencodes (z.B. 'MUC'). Wandle Städtenamen in IATA-Codes um.
    - Nenne immer den CO2-Ausstoß, der in den Daten geliefert wird.

    HOTELS (SerpApi):
    - Nutze \`searchHotels\` für Unterkunftsanfragen.
    - Hier darfst du normale Städtenamen für den Parameter 'q' verwenden (z.B. "Hotels in Rom").
    - Zeige Preis pro Nacht, Gesamtpreis und Bewertung an.
    - Wenn die API-Daten "Eco-certified" oder ähnliches enthalten, hebe das hervor.
    
    PRÄSENTATION:
    - Gib IMMER Links zu den Angeboten an (Google Flights / Google Hotels Deep Links).
    - Label Links als "[Zum Angebot](url)".
    
    - Wenn du konkrete, komplette Reiseoptionen (Transport + Ziel + Vibe) vorschlägst:
    - Rufe das Tool \`displayRecommendations\` auf und übergebe 2-3 Optionen für die Kartenansicht.
    
    Sei freundlich, professionell, kurz und nutze Markdown.
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
      contents: `Basierend auf dem folgenden Chat-Verlauf, extrahiere die Details der final vereinbarten Reise im JSON-Format. Wenn keine Reise final vereinbart wurde, antworte mit NULL.
      
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
