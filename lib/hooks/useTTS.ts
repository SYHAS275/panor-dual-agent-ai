"use client";

import { useState, useCallback, useRef, useEffect } from 'react';

export type TTSProvider = 'personaplex' | 'openai' | 'browser';

export interface TTSState {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  currentProvider: TTSProvider | null;
  availableProviders: TTSProvider[];
}

export interface TTSOptions {
  provider?: TTSProvider;
  voice?: string;
  speed?: number;
}

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isLoading: false,
    error: null,
    currentProvider: null,
    availableProviders: ['browser'],
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Fetch available providers on mount
  useEffect(() => {
    fetch('/api/tts')
      .then((res) => res.json())
      .then((data) => {
        if (data.providers) {
          setState((prev) => ({
            ...prev,
            availableProviders: data.providers,
          }));
        }
      })
      .catch(() => {
        // Keep browser as default if API fails
      });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Stop playback - defined first so speak can use it
  const stop = useCallback(() => {
    // Clear utterance ref first so onerror handler knows it was intentional
    utteranceRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setState((prev) => ({ ...prev, isPlaying: false, isLoading: false, error: null }));
  }, []);

  // Browser TTS using Web Speech API
  const speakWithBrowser = useCallback((text: string, voice?: string, speed?: number) => {
    return new Promise<void>((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Browser does not support speech synthesis'));
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed || 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Set voice if specified
      if (voice && voice !== 'default') {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find((v) => v.name === voice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      utterance.onend = () => {
        setState((prev) => ({ ...prev, isPlaying: false }));
        resolve();
      };

      utterance.onerror = (event) => {
        // If utteranceRef was cleared, stop() was called intentionally - resolve cleanly
        if (!utteranceRef.current || event.error === 'canceled' || event.error === 'interrupted') {
          setState((prev) => ({ ...prev, isPlaying: false }));
          resolve();
          return;
        }
        setState((prev) => ({ ...prev, isPlaying: false, error: event.error }));
        reject(new Error(event.error));
      };

      utteranceRef.current = utterance;
      setState((prev) => ({ ...prev, isPlaying: true, currentProvider: 'browser' }));
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // Server TTS using PersonaPlex or OpenAI
  const speakWithServer = useCallback(async (text: string, provider: TTSProvider, voice?: string, speed?: number) => {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, provider, voice, speed }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'TTS failed');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setState((prev) => ({ ...prev, isPlaying: false }));
        resolve();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setState((prev) => ({ ...prev, isPlaying: false }));
        reject(new Error('Audio playback failed'));
      };

      setState((prev) => ({ ...prev, isPlaying: true, currentProvider: provider }));
      audio.play();
    });
  }, []);

  // Main speak function with automatic fallback
  const speak = useCallback(async (text: string, options: TTSOptions = {}) => {
    const { provider, voice, speed } = options;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Stop any current playback
      stop();

      const selectedProvider = provider || state.availableProviders[0] || 'browser';

      if (selectedProvider === 'browser') {
        await speakWithBrowser(text, voice, speed);
      } else {
        // Try server TTS, fall back to browser if it fails
        try {
          await speakWithServer(text, selectedProvider, voice, speed);
        } catch (serverError) {
          console.warn(`Server TTS (${selectedProvider}) failed, falling back to browser:`, serverError);
          // Fall back to browser TTS
          await speakWithBrowser(text, voice, speed);
        }
      }

      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      // If even browser TTS fails, show error
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isPlaying: false,
        error: error instanceof Error ? error.message : 'Speech synthesis failed',
      }));
    }
  }, [state.availableProviders, speakWithBrowser, speakWithServer, stop]);

  // Pause playback
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  // Resume playback
  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, []);

  // Get browser voices
  const getBrowserVoices = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }
    return window.speechSynthesis.getVoices().map((v) => ({
      id: v.name,
      name: `${v.name} (${v.lang})`,
    }));
  }, []);

  return {
    ...state,
    speak,
    stop,
    pause,
    resume,
    getBrowserVoices,
  };
}

// Voice options for settings UI
export const VOICE_OPTIONS = {
  personaplex: [
    { id: 'default', name: 'Default Voice' },
    { id: 'NATF2', name: 'Natural Female' },
    { id: 'NATM1', name: 'Natural Male' },
  ],
  openai: [
    { id: 'alloy', name: 'Alloy (Neutral)' },
    { id: 'echo', name: 'Echo (Male)' },
    { id: 'fable', name: 'Fable (British)' },
    { id: 'onyx', name: 'Onyx (Deep Male)' },
    { id: 'nova', name: 'Nova (Female)' },
    { id: 'shimmer', name: 'Shimmer (Soft Female)' },
  ],
  browser: [
    { id: 'default', name: 'System Default' },
  ],
};

export const PROVIDER_NAMES = {
  personaplex: 'NVIDIA PersonaPlex',
  openai: 'OpenAI TTS',
  browser: 'Browser (Free)',
};
