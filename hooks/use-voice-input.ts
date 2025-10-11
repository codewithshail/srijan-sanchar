/**
 * React hook for voice input using STT service
 * Supports both Web Speech API and WebRTC streaming
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { sttService } from "@/lib/ai";

interface UseVoiceInputOptions {
  language?: string;
  useWebRTC?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const {
    language = "en-IN",
    useWebRTC = false,
    onTranscript,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
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

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      setTranscript(text);
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

  return {
    isRecording,
    transcript,
    error,
    isSupported,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
