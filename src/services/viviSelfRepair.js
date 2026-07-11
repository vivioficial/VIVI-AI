// src/services/viviSelfRepair.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicialización limpia sin dependencias externas
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function diagnoseAndRepairError(errorMessage, codeContext) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const prompt = `
      Eres Vivi AI en modo de autoreparación. Se ha detectado el siguiente error en el sistema:
      Error: ${errorMessage}
      
      Contexto del código o estado actual:
      ${codeContext}
      
      Analiza la causa raíz y proporciona:
      1. Una explicación breve del problema.
      2. El fragmento de código exacto corregido listo para reemplazar.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error en el sistema de auto-diagnóstico de Vivi:", error);
    return "No pude procesar el diagnóstico debido a un fallo en la conexión con la API de IA.";
  }
}
