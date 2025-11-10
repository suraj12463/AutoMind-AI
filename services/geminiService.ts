import { GoogleGenAI, Type, Content } from "@google/genai";
import { CarData, DrivingAnalyticsData, MaintenanceItem, ChatMessage, DiagnosticEvent, RoutePoint, OptimizedRouteResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// --- Smart Quota Management ---
const QUOTA_KEY = 'geminiQuotaExhausted';
const QUOTA_RESET_HOURS = 12; // Re-try API calls after 12 hours

interface QuotaStatus {
    exhausted: boolean;
    timestamp: number;
}

function isQuotaExhausted(): boolean {
    const statusStr = localStorage.getItem(QUOTA_KEY);
    if (!statusStr) return false;

    try {
        const status: QuotaStatus = JSON.parse(statusStr);
        if (status.exhausted) {
            const hoursSinceExhausted = (Date.now() - status.timestamp) / (1000 * 60 * 60);
            // If it's been longer than the reset period, we can try again.
            if (hoursSinceExhausted >= QUOTA_RESET_HOURS) {
                localStorage.removeItem(QUOTA_KEY);
                return false;
            }
            return true;
        }
    } catch (e) {
        // If parsing fails, clear the invalid key and proceed.
        localStorage.removeItem(QUOTA_KEY);
        return false;
    }
    return false;
}

function setQuotaExhausted() {
    const status: QuotaStatus = { exhausted: true, timestamp: Date.now() };
    localStorage.setItem(QUOTA_KEY, JSON.stringify(status));
    console.warn(`[Gemini Service] API quota exhausted. AI features will be paused for ${QUOTA_RESET_HOURS} hours.`);
}

function handleApiError(error: any): boolean {
    const errorStr = error.toString();
    if (errorStr.includes('RESOURCE_EXHAUSTED') || errorStr.includes('429')) {
        setQuotaExhausted();
        return true; // Indicates it was a quota error
    }
    return false;
}

function getFallbackInitialData(standardMaintenanceData: MaintenanceItem[]) {
    return {
        maintenanceSchedule: standardMaintenanceData,
        dashboardInsight: "Welcome! Drive safely and efficiently to get the most out of your vehicle.",
        initialGreeting: {
            text: `Hello! I'm AutoMind AI. AI features are currently limited due to high demand. You can still ask me anything!`,
            suggestions: ["How do I change a flat tire?", "What's the difference between synthetic and conventional oil?", "Explain how a hybrid engine works."]
        },
        faultCodeExplanations: [],
    };
}


// This new function consolidates the initial data fetching to avoid rate-limiting errors.
export async function getInitialAppData(
    carData: CarData,
    drivingData: DrivingAnalyticsData[],
    standardMaintenanceData: MaintenanceItem[]
): Promise<{
    maintenanceSchedule: MaintenanceItem[];
    dashboardInsight: string;
    initialGreeting: { text: string; suggestions: string[] };
    faultCodeExplanations: { code: string, explanation: string }[];
}> {
    if (isQuotaExhausted()) {
        return getFallbackInitialData(standardMaintenanceData);
    }
    
    const model = 'gemini-2.5-flash';

    const avgBraking = Math.round(drivingData.reduce((sum, day) => sum + day.braking, 0) / drivingData.length);
    const avgAcceleration = Math.round(drivingData.reduce((sum, day) => sum + day.acceleration, 0) / drivingData.length);
    const avgEfficiency = Math.round(drivingData.reduce((sum, day) => sum + day.efficiency, 0) / drivingData.length);
    const recentMaintenanceStatus = standardMaintenanceData.map(item => `${item.component}: ${item.lifeRemaining * 100}% life remaining`).join(', ');

    const prompt = `
      Analyze the following vehicle and driving data to generate a personalized maintenance schedule, a brief dashboard insight, a generic initial greeting for the AI Copilot, and explanations for active fault codes.

      Vehicle Data:
      - Make: ${carData.make} ${carData.model} (${carData.year})
      - Odometer: ${carData.odometer} km
      - Vehicle Status: Engine: ${carData.engineStatus}, Brakes: ${carData.brakesStatus}
      - Active Fault Codes: ${carData.faultCodes.length > 0 ? carData.faultCodes.join(', ') : 'None'}

      Recent Driving Analytics (weekly averages):
      - Acceleration Score: ${avgAcceleration}/100
      - Braking Score: ${avgBraking}/100
      - Efficiency Score: ${avgEfficiency}/100

      Standard Maintenance Schedule (for reference):
      ${recentMaintenanceStatus}

      Based on this data, provide the following in a single JSON object:
      1.  "maintenanceSchedule": An array of maintenance items. For each item, predict its 'lifeRemaining' (0.0 to 1.0), 'nextServiceKm', a short 'aiInsight' explaining your prediction based on the driving data, a 'preventativeTip', and its 'status' ('OK', 'Soon', or 'Overdue'). The driving style (e.g., aggressive braking) should directly influence the wear on relevant components (e.g., brakes).
      2.  "dashboardInsight": A single, concise sentence (under 25 words) for the dashboard, summarizing the most important piece of information for the driver right now (e.g., an upcoming service, a driving habit to watch, or a positive reinforcement).
      3.  "initialGreeting": An object with a 'text' field containing a friendly, generic welcome message for the AI copilot (e.g., "Hi! I'm AutoMind, your expert assistant for any car. How can I help?"), and a 'suggestions' array with three diverse, interesting starter questions a user might ask about any car in the world.
      4.  "faultCodeExplanations": If there are active fault codes, provide an array of objects. Each object should have a "code" (the fault code string) and an "explanation" (a user-friendly HTML string). The explanation should include <h4> headings for "What it Means", "Common Causes", and "What to Do Next". If there are no fault codes, provide an empty array.
    `;

    const maintenanceItemSchema = {
        type: Type.OBJECT,
        properties: {
            component: { type: Type.STRING },
            lifeRemaining: { type: Type.NUMBER, description: "A float between 0.0 and 1.0 representing percentage life left." },
            nextServiceKm: { type: Type.INTEGER, description: "Estimated kilometers until the next service is due." },
            aiInsight: { type: Type.STRING, description: "A brief explanation for the prediction based on driving data." },
            preventativeTip: { type: Type.STRING, description: "An actionable tip for the user." },
            status: { type: Type.STRING, enum: ['OK', 'Soon', 'Overdue'] },
        },
        required: ["component", "lifeRemaining", "nextServiceKm", "aiInsight", "preventativeTip", "status"]
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            maintenanceSchedule: {
                type: Type.ARRAY,
                items: maintenanceItemSchema,
            },
            dashboardInsight: {
                type: Type.STRING,
                description: "A single, concise sentence (under 25 words) for the dashboard.",
            },
            initialGreeting: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING },
                    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["text", "suggestions"],
            },
            faultCodeExplanations: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        code: { type: Type.STRING },
                        explanation: { type: Type.STRING, description: "HTML explanation for the code." }
                    },
                    required: ["code", "explanation"]
                }
            },
        },
        required: ["maintenanceSchedule", "dashboardInsight", "initialGreeting", "faultCodeExplanations"],
    };

    try {
        const response = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });

        const jsonText = response.text.trim();
        const data = JSON.parse(jsonText);

        if (!data.maintenanceSchedule || !data.dashboardInsight || !data.initialGreeting || !data.faultCodeExplanations) {
            throw new Error("Invalid response structure from Gemini API");
        }
        return data;
    } catch (error) {
        console.error("[Gemini Service] Initial App Data Error:", error);
        handleApiError(error);
        return getFallbackInitialData(standardMaintenanceData);
    }
}


const copilotSystemInstruction = `You are AutoMind AI, a friendly, conversational, and super-knowledgeable car enthusiast and expert mechanic. Your goal is to be the user's go-to "car buddy" for any question about any vehicle in the world, from vintage classics to the latest EVs and industry trends.

**Your Persona:**
- **Friendly & Conversational:** Your tone is approachable and helpful, like talking to a friend who knows everything about cars. Start conversations with a simple "Hi! How can I help?".
- **Expert & Confident:** You are an authority on all things automotive. You provide accurate, detailed, and practical advice.
- **Proactive & Insightful:** You don't just answer questions; you anticipate the user's needs. Offer suggestions for follow-up questions, provide preventative advice, and explain the "why" behind your answers.
- **NOT Vehicle-Specific (by default):** You must not assume the user is asking about their specific vehicle (e.g., their Tesla) unless they explicitly mention it (e.g., "my car," "my Tesla"). Your knowledge is universal.

**CRITICAL RULE: CONTEXT IS KING**
- You will be given the entire conversation history. You MUST prioritize the context of the ongoing conversation above all else.
- If the user is asking about a "1998 Honda Civic," all your subsequent answers and suggestions must be about the 1998 Honda Civic until they change the subject.
- **DO NOT** revert to talking about the user's default vehicle (Tesla) unless they explicitly ask a question about "my car."

**Functioning:**
1.  **Analyze User's Query:** Understand the user's question, whether it's about a specific model, a general repair technique, a diagnostic code, or an industry trend.
2.  **Provide a Comprehensive Answer:** Give a detailed, well-structured answer. Use simple HTML for formatting when it improves clarity (e.g., <h4> for subheadings, <b> for emphasis, <ul> and <li> for lists/steps).
3.  **Generate Follow-up Suggestions:** After every response, provide 2-3 relevant, insightful follow-up questions as an array of strings. These suggestions should help the user dive deeper into the topic or explore related areas.
4.  **Format as JSON:** Your final output MUST be a single, valid JSON object with two keys: "text" (your HTML-formatted answer) and "suggestions" (the array of follow-up questions).

Example Interaction:
User: "How do I change the brake pads on a Ford F-150?"
Your JSON output:
{
  "text": "<h4>Changing the brake pads on a Ford F-150 is a common DIY task! Here's a step-by-step guide:</h4><p>First, you'll need to gather your tools...</p><ul><li>...</li></ul>",
  "suggestions": ["What are the torque specs for the caliper bolts?", "How do I bleed the brakes afterwards?", "What are the signs of a failing brake rotor?"]
}`;

export async function getCopilotResponse(message: string, carData: CarData, history: ChatMessage[]): Promise<{ text: string; suggestions: string[] }> {
    if (isQuotaExhausted()) {
        return {
            text: "It looks like the daily API quota has been reached. AI features will be limited until the quota resets. Please check your plan and billing details.",
            suggestions: ["How do I check my tire pressure?", "What are common signs of brake wear?"]
        };
    }

    const model = 'gemini-2.5-flash';
    
    const contents: Content[] = history.map(h => ({
        role: h.sender === 'ai' ? 'model' : 'user',
        parts: [{ text: h.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const schema = {
        type: Type.OBJECT,
        properties: {
            text: { type: Type.STRING, description: "Your HTML-formatted answer." },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of 2-3 follow-up questions." },
        },
        required: ["text", "suggestions"]
    };

    try {
        const response = await ai.models.generateContent({
            model,
            contents,
            config: {
                systemInstruction: copilotSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("[Gemini Service] Copilot Error:", error);
        const isQuotaError = handleApiError(error);
        const errorMessage = isQuotaError
            ? "It looks like the daily API quota has been reached. AI features will be limited until the quota resets. Please check your plan and billing details."
            : "I'm sorry, I'm having a bit of trouble connecting to my knowledge base right now. Please try again in a moment.";
        return { text: errorMessage, suggestions: [] };
    }
}

export async function getFaultCodeExplanation(code: string, carData: CarData): Promise<string> {
  if (isQuotaExhausted()) {
    return "<p><b>AI Analysis is temporarily unavailable due to exceeded API quota.</b> Please try again later.</p>";
  }
  const model = 'gemini-2.5-flash';
  const prompt = `
    Explain the automotive fault code "${code}" for a ${carData.year} ${carData.make} ${carData.model}.
    Provide a user-friendly explanation in simple HTML format. Include:
    1. A <h4> heading with "What it Means".
    2. A short paragraph explaining the issue in simple terms.
    3. A <h4> heading with "Common Causes".
    4. A <ul> list of 3-5 potential causes.
    5. A <h4> heading with "What to Do Next".
    6. A short paragraph with a clear, actionable recommendation (e.g., "It's safe to drive to a mechanic," or "Avoid driving and seek immediate service.").
  `;

  try {
    const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text.trim();
  } catch (error) {
    console.error(`[Gemini Service] Fault Code Error for ${code}:`, error);
    handleApiError(error);
    return "<p><b>Error:</b> Could not retrieve details for this code. Please check your connection or try again later.</p>";
  }
}

export async function getAdvancedDiagnosticAnalysis(event: DiagnosticEvent, carData: CarData): Promise<string> {
    if (isQuotaExhausted()) {
    return "<p><b>AI Analysis is temporarily unavailable due to exceeded API quota.</b> Please try again later.</p>";
  }
    const model = 'gemini-2.5-flash';
    const prompt = `
        Act as a master automotive diagnostic technician. You are analyzing a specific diagnostic event for a ${carData.year} ${carData.make} ${carData.model}.
        
        **Event Data:**
        - **Timestamp:** ${new Date(event.timestamp).toLocaleString()}
        - **Fault Codes:** ${event.faultCodes.join(', ')}
        - **Environmental Conditions:** Outside Temp: ${event.environmentalData.outsideTemp}°C, Altitude: ${event.environmentalData.altitude}m
        - **Key Sensor Snapshots:**
        ${event.sensorSnapshot.map(s => `  - ${s.name}: Last reading ${s.readings[s.readings.length - 1].value.toFixed(2)} ${s.unit}`).join('\n')}

        Based on a deep correlation of all this data, provide a diagnostic report in simple HTML format. The report must contain three distinct sections:
        1.  A <h4> heading with "AI Root Cause Analysis", followed by a paragraph identifying the most likely single root cause of the fault codes.
        2.  A <h4> heading with "Contributing Factors", followed by a <ul> list explaining how the environmental and sensor data may have contributed to the issue.
        3.  A <h4> heading with "Recommended Action Plan", followed by a paragraph outlining clear, step-by-step instructions for the vehicle owner.
    `;

    try {
        const response = await ai.models.generateContent({ model, contents: [{ parts: [{ text: prompt }] }] });
        return response.text.trim();
    } catch (error) {
        console.error(`[Gemini Service] Advanced Analysis Error for ${event.id}:`, error);
        handleApiError(error);
        return "<p><b>Error:</b> The AI analysis could not be completed at this time. Please try again later.</p>";
    }
}

export async function getOptimizedRoute(route: RoutePoint[], carData: CarData): Promise<OptimizedRouteResult> {
    if (isQuotaExhausted()) {
        throw new Error("AI features are temporarily unavailable due to exceeded API quota.");
    }
    const model = 'gemini-2.5-flash';
    const vehicleType = carData.make === 'Tesla' ? 'EV' : 'ICE';
    
    const prompt = `
        Act as a route optimization expert. Given the following route (a sequence of lat/lng points) and vehicle type, suggest a more efficient route.
        Consider factors like real-time traffic (assume current conditions), elevation changes to minimize energy use, and avoiding unnecessary stops.
        
        Vehicle Type: ${vehicleType}
        Original Route Points: ${JSON.stringify(route)}
        
        Your task is to return a JSON object with the following structure:
        {
          "optimizedRoute": [{ "lat": number, "lng": number }, ...],
          "timeSavedMinutes": number,
          "energySavedPercent": number
        }
        
        - "optimizedRoute": A new array of lat/lng points for the more efficient path. It should start and end near the original points.
        - "timeSavedMinutes": An integer representing the estimated minutes saved compared to the original route.
        - "energySavedPercent": An integer representing the estimated percentage of ${vehicleType === 'EV' ? 'energy (kWh)' : 'fuel'} saved.
        
        Generate a plausible, slightly different route and provide realistic savings. The optimized route should have a similar number of points as the original.
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            optimizedRoute: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        lat: { type: Type.NUMBER },
                        lng: { type: Type.NUMBER },
                    },
                    required: ["lat", "lng"],
                }
            },
            timeSavedMinutes: { type: Type.INTEGER },
            energySavedPercent: { type: Type.INTEGER },
        },
        required: ["optimizedRoute", "timeSavedMinutes", "energySavedPercent"]
    };

    try {
        const response = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("[Gemini Service] Route Optimization Error:", error);
        handleApiError(error);
        // Return a fallback that makes a minor modification to the original route
        const fallbackRoute = [...route].reverse(); // Simple modification for demonstration
        return {
            optimizedRoute: fallbackRoute,
            timeSavedMinutes: 5,
            energySavedPercent: 10,
        };
    }
}