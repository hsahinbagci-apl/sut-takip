import { GoogleGenAI, Type } from "@google/genai";
import { getSUTCodes } from "./storageService";

const getAI = () => {
    // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
        console.warn("API Key eksik veya bulunamadı. Yapay zeka özellikleri devre dışı.");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

export const analyzeMedicalNote = async (note: string): Promise<{ suggestedCodes: string[], summary: string }> => {
    const ai = getAI();
    if (!ai) {
        return { suggestedCodes: [], summary: "" };
    }

    // Use current codes from storage instead of static mock data
    const currentCodes = getSUTCodes();
    const availableCodes = currentCodes.map(c => `${c.code}: ${c.description}`).join('\n');

    const prompt = `
    Aşağıdaki tıbbi notu analiz et.
    1. Verilen SUT kodu listesinden, bu nota en uygun olabilecek SUT kodlarını bul ve kodlarını listele (örn: "530.010").
    2. Notun kısa, resmi bir özetini çıkar.

    Mevcut SUT Kodları:
    ${availableCodes}

    Tıbbi Not:
    "${note}"
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestedCodes: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        summary: {
                            type: Type.STRING
                        }
                    }
                }
            }
        });

        const result = JSON.parse(response.text || "{}");
        return {
            suggestedCodes: result.suggestedCodes || [],
            summary: result.summary || ""
        };

    } catch (error) {
        console.error("Gemini analysis failed:", error);
        return { suggestedCodes: [], summary: "" };
    }
};