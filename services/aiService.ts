import { GoogleGenAI } from "@google/genai";
import { ShipStats, ShipType } from "../types";

// Helper to get Gemini text advice
export const getTacticalBriefing = async (shipType: ShipType, stats: ShipStats): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Tactical Uplink Offline: API Key Missing. Proceed with standard protocols.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      You are a battle-hardened squadron commander in a futuristic sci-fi setting.
      I am about to pilot a ship of class "${shipType}" with the following stats:
      - Speed: ${stats.maxSpeed} (High is fast)
      - Armor: ${stats.maxHp} (High is durable)
      - Fire Rate: ${stats.fireRate}ms (Lower is faster)
      - Damage: ${stats.damage} (Per shot)
      
      Give me a single, punchy, 2-sentence tactical tip on how to win a dogfight against an unknown enemy using this specific ship. 
      Be cool and military-style. Do not mention specific numbers.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Communication jammed. Fly safe, pilot.";
  } catch (error) {
    console.error("AI Service Error:", error);
    return "Tactical Uplink Error. Rely on your instincts.";
  }
};
