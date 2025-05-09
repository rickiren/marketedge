import { useState, useCallback, useEffect } from 'react';

const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

export function useSound() {
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('alertSoundMuted');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('alertSoundMuted', JSON.stringify(isMuted));
  }, [isMuted]);

  const playSound = useCallback(() => {
    if (!isMuted) {
      alertSound.currentTime = 0;
      alertSound.play().catch(error => {
        console.warn('Error playing sound:', error);
      });
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  return { isMuted, playSound, toggleMute };
}