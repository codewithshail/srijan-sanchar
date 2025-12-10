/**
 * React hook for voice input using STT service
 * Supports both Web Speech API and WebRTC streaming
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { SUPPORTED_STT_LANGUAGES } from "@/lib/ai/constants";
import { sttService } from "@/lib/ai/stt-service";

interface UseVoiceInputOptions {
  language?: string;
  useWebRTC?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
  persistLanguage?: boolean;
}

const LANGUAGE_STORAGE_KEY = "voice-input-language";

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const {
    language: initialLanguage = "en-IN",
    useWebRTC = false,
    onTranscript,
    onError,
    persistLanguage = true,
  } = options;

  // Load persisted language preference
  const getInitialLanguage = () => {
    if (typeof window !== "undefined" && persistLanguage) {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && SUPPORTED_STT_LANGUAGES.some((l) => l.code === saved)) {
        return saved;
      }
    }
    return initialLanguage;
  };

  const [language, setLanguageState] = useState(getInitialLanguage);

  // Setter that also persists to localStorage
  const setLanguage = useCallback(
    (newLanguage: string) => {
      setLanguageState(newLanguage);
      if (typeof window !== "undefined" && persistLanguage) {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
      }
    },
    [persistLanguage]
  );

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const stopFunctionRef = useRef<(() => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Check if browser supports required APIs
    if (typeof window === "undefined") {
      setIsSupported(false);
      return;
    }

    const hasWebSpeech =
      !!(window as any).SpeechRecognition ||
      !!(window as any).webkitSpeechRecognition;
    const hasMediaRecorder = !!window.MediaRecorder;

    setIsSupported(useWebRTC ? hasMediaRecorder : hasWebSpeech);
  }, [useWebRTC]);

  // Clear error after a timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal) {
        setTranscript(text);
        setInterimTranscript("");
      } else {
        setInterimTranscript(text);
      }
      onTranscript?.(text, isFinal);
    },
    [onTranscript]
  );

  const handleError = useCallback(
    (err: Error) => {
      console.error("[USE_VOICE_INPUT] Error:", err);
      setError(err);
      setIsRecording(false);
      onError?.(err);
    },
    [onError]
  );

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      const err = new Error("Voice input not supported in this browser");
      handleError(err);
      return;
    }

    try {
      setError(null);
      setTranscript("");

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Start transcription
      if (useWebRTC) {
        stopFunctionRef.current = await sttService.streamTranscribeWithWebRTC(
          stream,
          language,
          handleTranscript,
          handleError
        );
      } else {
        stopFunctionRef.current = await sttService.streamTranscribe(
          stream,
          language,
          handleTranscript,
          handleError
        );
      }

      setIsRecording(true);
    } catch (err) {
      handleError(
        err instanceof Error ? err : new Error("Failed to start recording")
      );
    }
  }, [isSupported, useWebRTC, language, handleTranscript, handleError]);

  const stopRecording = useCallback(() => {
    if (stopFunctionRef.current) {
      stopFunctionRef.current();
      stopFunctionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isRecording,
    transcript,
    interimTranscript,
    error,
    isSupported,
    language,
    setLanguage,
    supportedLanguages: SUPPORTED_STT_LANGUAGES,
    startRecording,
    stopRecording,
    toggleRecording,
    clearTranscript,
    clearError,
  };
}
