// LLM service — provides AI text generation, image generation, and speech synthesis.
// Supports OpenAI and Google Gemini via environment variables.
// Falls back to a safe stub when no API key is configured.

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini';
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash';

// Determine which LLM backend to use
function getBackend() {
  if (OPENAI_API_KEY) return 'openai';
  if (GEMINI_API_KEY) return 'gemini';
  return 'stub';
}

function bearerHeader(key) {
  return 'Bearer ' + key;
}

/** Call OpenAI Chat Completions API */
async function invokeOpenAI({ prompt, systemPrompt, maxTokens = 2048 }) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: bearerHeader(OPENAI_API_KEY),
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'OpenAI error: ' + response.status);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Call Google Gemini API */
async function invokeGemini({ prompt, systemPrompt, maxTokens = 2048 }) {
  const contents = [];
  if (systemPrompt) {
    // Gemini requires alternating user/model turns; seed with the system prompt
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'OK.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gemini error: ' + response.status);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/** Stub response when no LLM is configured */
function invokeStub({ prompt }) {
  console.warn('[LLM] No API key configured (VITE_OPENAI_API_KEY or VITE_GEMINI_API_KEY). Returning stub response.');
  return Promise.resolve(
    'Lo siento, no hay un servicio de IA configurado. ' +
    'Por favor configura VITE_OPENAI_API_KEY o VITE_GEMINI_API_KEY en tu archivo .env.local.'
  );
}

export const llmService = {
  /**
   * Invoke an LLM to generate text.
   * @param {object} options
   * @param {string} options.prompt - The user prompt
   * @param {string} [options.systemPrompt] - Optional system/context prompt
   * @param {number} [options.maxTokens=2048] - Max tokens to generate
   * @returns {Promise<string>} Generated text
   */
  async InvokeLLM(options) {
    const backend = getBackend();
    try {
      if (backend === 'openai') return await invokeOpenAI(options);
      if (backend === 'gemini') return await invokeGemini(options);
      return await invokeStub(options);
    } catch (err) {
      console.error('[LLM] InvokeLLM failed:', err.message);
      throw err;
    }
  },

  /**
   * Generate an image from a text prompt using OpenAI DALL-E.
   * @param {object} options
   * @param {string} options.prompt - Image description
   * @returns {Promise<string|null>} Image URL
   */
  async GenerateImage({ prompt }) {
    if (!OPENAI_API_KEY) {
      console.warn('[LLM] Image generation requires VITE_OPENAI_API_KEY');
      return null;
    }
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: bearerHeader(OPENAI_API_KEY),
      },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024' }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Image generation error: ' + response.status);
    }
    const data = await response.json();
    return data.data?.[0]?.url || null;
  },

  /**
   * Generate speech audio from text using OpenAI TTS.
   * Falls back to the Web Speech API when OpenAI is not configured.
   * @param {object} options
   * @param {string} options.text - Text to speak
   * @param {string} [options.voice='nova'] - Voice name
   * @returns {Promise<string|null>} Audio URL or null (for Web Speech API fallback)
   */
  async GenerateSpeech({ text, voice = 'nova' }) {
    if (OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: bearerHeader(OPENAI_API_KEY),
          },
          body: JSON.stringify({ model: 'tts-1', input: text, voice }),
        });
        if (response.ok) {
          const blob = await response.blob();
          return URL.createObjectURL(blob);
        }
      } catch (err) {
        console.warn('[LLM] OpenAI TTS failed, using Web Speech API:', err.message);
      }
    }
    // Web Speech API fallback
    if ('speechSynthesis' in window) {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'es-ES';
      window.speechSynthesis.speak(utt);
    }
    return null;
  },

  /**
   * Upload a file and extract its content using OpenAI Vision.
   * @param {object} options
   * @param {File} options.file - The file to process
   * @returns {Promise<object>} Extracted data
   */
  async ExtractDataFromUploadedFile({ file }) {
    if (!OPENAI_API_KEY || !file) return { text: '', error: 'Not configured' };
    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearerHeader(OPENAI_API_KEY),
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract and describe all text and data from this file.' },
                { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64 } },
              ],
            },
          ],
          max_tokens: 2048,
        }),
      });
      if (!response.ok) return { text: '', error: 'API error: ' + response.status };
      const data = await response.json();
      return { text: data.choices?.[0]?.message?.content || '' };
    } catch (err) {
      console.warn('[LLM] ExtractDataFromUploadedFile failed:', err.message);
      return { text: '', error: err.message };
    }
  },
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
