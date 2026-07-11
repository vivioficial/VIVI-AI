// src/vivi/services/voiceService.js

export class VoiceService {
  constructor(onResult, onSpeechEnd, onSpeechStart) {
    this.onResult = onResult;
    this.onSpeechEnd = onSpeechEnd;
    this.onSpeechStart = onSpeechStart;
    
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.utterance = null;
    this.isListening = false;
    this.isSpeaking = false;

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Este navegador no soporta Web Speech API para reconocimiento de voz.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false; // Cambiar a true si deseas flujo constante sin pausas
    this.recognition.interimResults = false;
    this.recognition.lang = 'es-ES'; // Idioma por defecto

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onSpeechStart) this.onSpeechStart();
    };

    this.recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      if (this.onResult) this.onResult(text);
    };

    this.recognition.onerror = (event) => {
      console.error("Error en reconocimiento de voz:", event.error);
      this.isListening = false;
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onSpeechEnd) this.onSpeechEnd();
    };
  }

  startListening() {
    if (this.recognition && !this.isListening) {
      if (this.isSpeaking) this.cancelSpeech(); // Interrupción por voz (Barge-in)
      try {
        this.recognition.start();
      } catch (e) {
        console.error("Error al iniciar escucha:", e);
      }
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  speak(text) {
    if (!this.synthesis) return;

    this.cancelSpeech(); // Detener cualquier audio previo antes de hablar

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.lang = 'es-ES';
    
    // Buscar una voz en español que suene natural si está disponible
    const voices = this.synthesis.getVoices();
    const spanishVoice = voices.find(voice => voice.lang.startsWith('es'));
    if (spanishVoice) {
      this.utterance.voice = spanishVoice;
    }

    this.utterance.onstart = () => {
      this.isSpeaking = true;
      this.stopListening(); // Evita que el bot se escuche a sí mismo (Half-duplex inteligente)
    };

    this.utterance.onend = () => {
      this.isSpeaking = false;
      // Una vez que termina de hablar, vuelve a escuchar automáticamente (Flujo continuo de llamada)
      this.startListening();
    };

    this.utterance.onerror = (e) => {
      console.error("Error en síntesis de voz:", e);
      this.isSpeaking = false;
      this.startListening();
    };

    this.synthesis.speak(this.utterance);
  }

  cancelSpeech() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }
}