"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Mic,
  MicOff,
  Languages,
  AlertCircle,
  Volume2,
  Settings2,
  X,
} from "lucide-react";
import { SUPPORTED_STT_LANGUAGES } from "@/lib/ai/constants";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  defaultLanguage?: string;
  compact?: boolean;
}

interface VoiceInputState {
  isRecording: boolean;
  isSupported: boolean;
  error: string | null;
  interimTranscript: string;
  selectedLanguage: string;
  audioLevel: number;
}

export function VoiceInput({
  onTranscript,
  disabled = false,
  className,
  defaultLanguage = "en-IN",
  compact = false,
}: VoiceInputProps) {
  const [state, setState] = useState<VoiceInputState>({
    isRecording: false,
    isSupported: true,
    error: null,
    interimTranscript: "",
    selectedLanguage: defaultLanguage,
    audioLevel: 0,
  });

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check browser support and load persisted language on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      setState((prev) => ({ ...prev, isSupported: false }));
      return;
    }

    // Load persisted language preference
    const savedLanguage = localStorage.getItem("voice-input-language");
    if (savedLanguage && SUPPORTED_STT_LANGUAGES.some((l) => l.code === savedLanguage)) {
      setState((prev) => ({ ...prev, selectedLanguage: savedLanguage }));
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState((prev) => ({
        ...prev,
        isSupported: false,
        error: "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.",
      }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume level
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedLevel = Math.min(100, (average / 128) * 100);

    setState((prev) => ({ ...prev, audioLevel: normalizedLevel }));

    if (state.isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [state.isRecording]);

  const startRecording = useCallback(async () => {
    if (!state.isSupported || disabled) return;

    setState((prev) => ({
      ...prev,
      error: null,
      interimTranscript: "",
    }));

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Set up audio level monitoring
      try {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;
      } catch (audioErr) {
        console.warn("[VOICE_INPUT] Audio level monitoring not available:", audioErr);
      }

      // Initialize speech recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = state.selectedLanguage;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setState((prev) => ({ ...prev, isRecording: true }));
        // Start audio level monitoring
        if (analyserRef.current) {
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setState((prev) => ({ ...prev, interimTranscript }));

        if (finalTranscript) {
          onTranscript(finalTranscript);
          setState((prev) => ({ ...prev, interimTranscript: "" }));
        }
      };

      recognition.onerror = (event: any) => {
        console.error("[VOICE_INPUT] Recognition error:", event.error);
        
        let errorMessage = "Voice recognition error";
        switch (event.error) {
          case "no-speech":
            errorMessage = "No speech detected. Please try speaking again.";
            break;
          case "audio-capture":
            errorMessage = "Microphone not available. Please check your microphone settings.";
            break;
          case "not-allowed":
            errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
            break;
          case "network":
            errorMessage = "Network error. Please check your internet connection.";
            break;
          case "aborted":
            // User stopped, not an error
            return;
          default:
            errorMessage = `Voice recognition error: ${event.error}`;
        }

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isRecording: false,
        }));
        
        stopRecording();
      };

      recognition.onend = () => {
        // Only update state if we're still supposed to be recording
        // (prevents state update after intentional stop)
        if (recognitionRef.current === recognition) {
          setState((prev) => ({ ...prev, isRecording: false }));
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("[VOICE_INPUT] Failed to start recording:", err);
      
      let errorMessage = "Failed to start voice input";
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
        } else if (err.name === "NotFoundError") {
          errorMessage = "No microphone found. Please connect a microphone and try again.";
        } else {
          errorMessage = err.message;
        }
      }

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isRecording: false,
      }));
    }
  }, [state.isSupported, state.selectedLanguage, disabled, onTranscript, updateAudioLevel]);

  const stopRecording = useCallback(() => {
    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("[VOICE_INPUT] Error stopping recognition:", err);
      }
      recognitionRef.current = null;
    }

    // Stop audio level monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (err) {
        console.warn("[VOICE_INPUT] Error closing audio context:", err);
      }
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isRecording: false,
      audioLevel: 0,
      interimTranscript: "",
    }));
  }, []);

  const toggleRecording = useCallback(() => {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  const handleLanguageChange = useCallback((languageCode: string) => {
    setState((prev) => ({ ...prev, selectedLanguage: languageCode }));
    
    // Persist language preference
    if (typeof window !== "undefined") {
      localStorage.setItem("voice-input-language", languageCode);
    }
    
    // If currently recording, restart with new language
    if (state.isRecording) {
      stopRecording();
      // Small delay before restarting
      setTimeout(() => {
        startRecording();
      }, 100);
    }
  }, [state.isRecording, stopRecording, startRecording]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const selectedLanguageInfo = SUPPORTED_STT_LANGUAGES.find(
    (lang) => lang.code === state.selectedLanguage
  );

  if (!state.isSupported) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled
          className="h-8 gap-1 opacity-50"
        >
          <MicOff className="h-4 w-4" />
          {!compact && <span>Voice unavailable</span>}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        {/* Main Voice Button */}
        <Button
          type="button"
          size="sm"
          variant={state.isRecording ? "destructive" : "outline"}
          onClick={toggleRecording}
          disabled={disabled}
          className={cn(
            "h-8 gap-1 transition-all",
            state.isRecording && "animate-pulse"
          )}
        >
          {state.isRecording ? (
            <>
              <MicOff className="h-4 w-4" />
              {!compact && <span>Stop</span>}
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              {!compact && <span>Voice</span>}
            </>
          )}
        </Button>

        {/* Language Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2"
              disabled={disabled}
            >
              <Languages className="h-4 w-4" />
              {!compact && (
                <span className="text-xs">
                  {selectedLanguageInfo?.nativeName || state.selectedLanguage}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Voice Language</span>
              </div>
              <Select
                value={state.selectedLanguage}
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_STT_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center gap-2">
                        <span>{lang.nativeName}</span>
                        <span className="text-xs text-muted-foreground">
                          ({lang.name})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground px-2">
                Select the language you'll be speaking in for better accuracy.
              </p>
            </div>
          </PopoverContent>
        </Popover>

        {/* Recording Indicator */}
        {state.isRecording && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Volume2 className="h-4 w-4 text-red-500 animate-pulse" />
              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-100"
                  style={{ width: `${state.audioLevel}%` }}
                />
              </div>
            </div>
            <Badge variant="destructive" className="text-xs animate-pulse">
              Recording
            </Badge>
          </div>
        )}
      </div>

      {/* Interim Transcript Display */}
      {state.interimTranscript && (
        <div className="px-3 py-2 bg-muted/50 rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground italic">
            {state.interimTranscript}
          </p>
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between text-sm">
            <span>{state.error}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearError}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default VoiceInput;
