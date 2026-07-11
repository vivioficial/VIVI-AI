// Vivi.jsx - Versión Optimizada
import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Keyboard, Settings2, LogOut, Power, Hand, PhoneCall } from 'lucide-react';
import { useVivi } from '@/vivi/hooks/useVivi';
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { EVENTS } from '@/vivi/events';
import ViviAvatar from '@/components/vivi/ViviAvatar';
import ViviStatusIndicator from '@/components/vivi/ViviStatusIndicator';
import { useNavigate } from 'react-router-dom';
import SettingsPanel from '@/components/vivi/SettingsPanel';
import PageTransition from '@/components/PageTransition';

export default function Vivi() {
  const { 
    avatarState, avatarGesture, avatarEmotion, caption, listening, 
    audioLevel, toggleMic, cancelSpeech, stopListening, updateSettings, 
    user, vivi, deliverGreeting, hasPendingGreeting 
  } = useVivi();

  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);

  // Manejo seguro del cierre de sesión
  const handleLogout = async () => {
    try {
      await cancelSpeech();
      if (listening) await stopListening();
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error("[Vivi UI] Error al cerrar sesión:", err);
    }
  };

  const handlePowerOff = useCallback(() => {
    cancelSpeech();
    if (listening) stopListening();
    setConversationStarted(false);
  }, [cancelSpeech, listening, stopListening]);

  // Lógica de inicio autónoma con verificación de existencias
  const startConversation = useCallback(() => {
    if (conversationStarted) return;
    setConversationStarted(true);

    if (!listening) {
      toggleMic();
    }

    // Ejecución segura de saludo
    if (typeof hasPendingGreeting === 'function' && hasPendingGreeting()) {
      setTimeout(() => {
        if (typeof deliverGreeting === 'function') deliverGreeting();
      }, 300);
    }
  }, [conversationStarted, listening, toggleMic, hasPendingGreeting, deliverGreeting]);

  // Listener global de interacción
  useEffect(() => {
    if (conversationStarted) return;
    const handler = () => startConversation();
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('touchend', handler, { once: true });
    
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('touchend', handler);
    };
  }, [conversationStarted, startConversation]);

  return (
    <PageTransition>
      <div className="fixed inset-0 overflow-hidden overscroll-none bg-[#0A0A0C] text-white">
        {/* ... [Mantén aquí tus fondos degradados] ... */}
        
        <div className="relative h-full flex flex-col items-center justify-center px-6">
          <ViviAvatar state={avatarState} gesture={avatarGesture} emotion={avatarEmotion} audioLevel={audioLevel} />
          <div className="mt-8 w-full flex justify-center">
            <ViviStatusIndicator state={avatarState} emotion={avatarEmotion} caption={caption} />
          </div>
        </div>

        {/* Overlay de inicio */}
        <AnimatePresence>
          {!conversationStarted && (
            <motion.div
              className="absolute inset-0 z-40 flex items-end justify-center pb-32 pointer-events-none"
              exit={{ opacity: 0 }}
            >
              <div className="pointer-events-auto cursor-pointer" onClick={startConversation}>
                <div className="px-5 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm">
                  Toca para iniciar Vivi
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ... [Resto de tus botones de control y SettingsPanel] ... */}
      </div>
    </PageTransition>
  );
}
