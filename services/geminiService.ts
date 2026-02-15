import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSUTCodes } from "./storageService";

const getAIModel = () => {
    // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
    const apiKey = process.env.VITE_API_KEY || "";

    if (!apiKey) {
        console.warn("API Key eksik veya bulunamadı. Yapay zeka özellikleri devre dışı.");
        return null;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
};

export const analyzeMedicalNote = async (note: string): Promise<{ suggestedCodes: string[], summary: string }> => {
    const model = getAIModel();
    if (!model) {
        return { suggestedCodes: [], summary: "" };
    }

    // Use current codes from storage instead of static mock data
    const currentCodes = getSUTCodes();
    const availableCodes = currentCodes.map(c => `${c.code}: ${c.description}`).join('\n');

    const prompt = `
    Aşağıdaki tıbbi notu analiz et ve sonucu JSON formatında döndür.
    
    JSON Şeması:
    {
      "suggestedCodes": ["string"],
      "summary": "string"
    }

    Analiz Kuralları:
    1. Verilen SUT kodu listesinden, bu nota en uygun olabilecek SUT kodlarını bul ve kodlarını listele (örn: "530.010").
    2. Notun kısa, resmi bir özetini çıkar.

    Mevcut SUT Kodları:
    ${availableCodes}

    Tıbbi Not:
    "${note}"
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const data = JSON.parse(text || "{}");
        return {
            suggestedCodes: data.suggestedCodes || [],
            summary: data.summary || ""
        };

    } catch (error) {
        console.error("Gemini analysis failed:", error);
        return { suggestedCodes: [], summary: "" };
    }
};