import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;

if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  console.log('Gemini API initialized successfully inside server/gemini.ts.');
} else {
  console.log('Running in offline/fallback mode inside server/gemini.ts (GEMINI_API_KEY is missing).');
}

export { ai };
