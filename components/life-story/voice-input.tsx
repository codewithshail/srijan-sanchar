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
  Settings2,
  X,
  Pause,
  Play,
  Square,
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
  isPaused: boolean;
  isSupported: boolean;
  error: string | null;
  interimTranscript: string;
  selectedLanguage: string;
  frequencyData: number[];
}

// Waveform visualization component
function WaveformVisualizer({
  frequencyData,
  isActive
}: {
  frequencyData: number[];
  isActive: boolean;
}) {
  const barCount = 24;

  return (
    <div className="flex items-center gap-0.5 h-8 px-2">
      {Array.from({ length: barCount }).map((_, i) => {
        // Get frequency value for this bar (sample from frequency data)
        const dataIndex = Math.floor((i / barCount) * frequencyData.length);
        const value = isActive ? (frequencyData[dataIndex] || 0) : 0;
        const height = Math.max(4, (value / 255) * 28);

        return (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-all duration-75",
              isActive
                ? "bg-gradient-to-t from-red-500 to-orange-400"
                : "bg-muted-foreground/30"
            )}
            style={{
              height: `${height}px`,
              opacity: isActive ? 0.8 + (value / 255) * 0.2 : 0.3
            }}
          />
        );
      })}
    </div>
  );
}

// Typing indicator component
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
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
    isPaused: false,
    isSupported: true,
    error: null,
    interimTranscript: "",
    selectedLanguage: defaultLanguage,
    frequencyData: new Array(64).fill(0),
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

  const updateFrequencyData = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Convert to regular array for state
    setState((prev) => ({
      ...prev,
      frequencyData: Array.from(dataArray.slice(0, 64))
    }));

    if (state.isRecording && !state.isPaused) {
      animationFrameRef.current = requestAnimationFrame(updateFrequencyData);
    }
  }, [state.isRecording, state.isPaused]);

  const startRecording = useCallback(async () => {
    if (!state.isSupported || disabled) return;

    setState((prev) => ({
      ...prev,
      error: null,
      interimTranscript: "",
      isPaused: false,
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

      // Set up audio analysis for waveform
      try {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 128;
        analyserRef.current.smoothingTimeConstant = 0.4;
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
        // Start frequency data monitoring
        if (analyserRef.current) {
          animationFrameRef.current = requestAnimationFrame(updateFrequencyData);
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
        if (recognitionRef.current === recognition && !state.isPaused) {
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
  }, [state.isSupported, state.selectedLanguage, state.isPaused, disabled, onTranscript, updateFrequencyData]);

  const stopRecording = useCallback(() => {
    // Save any pending interim transcript before stopping
    if (state.interimTranscript.trim()) {
      onTranscript(state.interimTranscript);
    }

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("[VOICE_INPUT] Error stopping recognition:", err);
      }
      recognitionRef.current = null;
    }

    // Stop frequency data monitoring
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
      isPaused: false,
      frequencyData: new Array(64).fill(0),
      interimTranscript: "",
    }));
  }, [state.interimTranscript, onTranscript]);

  const pauseRecording = useCallback(() => {
    if (!state.isRecording || state.isPaused) return;

    // Save any pending interim transcript before pausing
    if (state.interimTranscript.trim()) {
      onTranscript(state.interimTranscript);
      setState((prev) => ({ ...prev, interimTranscript: "" }));
    }

    // Pause speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("[VOICE_INPUT] Error pausing recognition:", err);
      }
    }

    // Stop frequency animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isPaused: true,
      frequencyData: new Array(64).fill(0),
    }));
  }, [state.isRecording, state.isPaused, state.interimTranscript, onTranscript]);

  const resumeRecording = useCallback(async () => {
    if (!state.isRecording || !state.isPaused) return;

    try {
      // Re-initialize speech recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = state.selectedLanguage;
      recognition.maxAlternatives = 1;

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
        if (event.error !== "aborted") {
          console.error("[VOICE_INPUT] Recognition error:", event.error);
          stopRecording();
        }
      };

      recognition.onend = () => {
        if (recognitionRef.current === recognition && !state.isPaused) {
          setState((prev) => ({ ...prev, isRecording: false }));
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

      setState((prev) => ({ ...prev, isPaused: false }));

      // Resume frequency monitoring
      if (analyserRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateFrequencyData);
      }
    } catch (err) {
      console.error("[VOICE_INPUT] Failed to resume recording:", err);
      stopRecording();
    }
  }, [state.isRecording, state.isPaused, state.selectedLanguage, onTranscript, stopRecording, updateFrequencyData]);

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
      <div className="flex items-center gap-2 flex-wrap">
        {/* Main Voice Button */}
        <Button
          type="button"
          size="sm"
          variant={state.isRecording ? "destructive" : "outline"}
          onClick={toggleRecording}
          disabled={disabled}
          className={cn(
            "h-9 gap-1.5 transition-all",
            state.isRecording && "shadow-lg shadow-red-500/25"
          )}
        >
          {state.isRecording ? (
            <>
              <div className="relative">
                <Mic className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full animate-ping" />
              </div>
              {!compact && <span>Recording</span>}
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              {!compact && <span>Voice</span>}
            </>
          )}
        </Button>

        {/* Pause/Resume and Stop buttons (visible when recording) */}
        {state.isRecording && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={state.isPaused ? resumeRecording : pauseRecording}
              className="h-9 w-9 p-0"
              title={state.isPaused ? "Resume" : "Pause"}
            >
              {state.isPaused ? (
                <Play className="h-4 w-4 text-green-600" />
              ) : (
                <Pause className="h-4 w-4 text-yellow-600" />
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={stopRecording}
              className="h-9 w-9 p-0"
              title="Stop"
            >
              <Square className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        )}

        {/* Language Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 gap-1 px-2"
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

        {/* Waveform Visualizer (visible when recording) */}
        {state.isRecording && (
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-1">
            <WaveformVisualizer
              frequencyData={state.frequencyData}
              isActive={!state.isPaused}
            />
            <Badge
              variant={state.isPaused ? "secondary" : "destructive"}
              className="text-xs"
            >
              {state.isPaused ? "Paused" : "Live"}
            </Badge>
          </div>
        )}
      </div>

      {/* Real-time Interim Transcript Display */}
      {(state.interimTranscript || (state.isRecording && !state.isPaused)) && (
        <div className="relative px-4 py-3 bg-gradient-to-r from-muted/80 to-muted/50 rounded-lg border border-dashed border-primary/30">
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="text-xs gap-1">
              <Mic className="h-3 w-3" />
              Listening
            </Badge>
          </div>
          <p className="text-sm text-foreground pr-20 min-h-[1.5rem]">
            {state.interimTranscript ? (
              <>
                <span className="font-medium">{state.interimTranscript}</span>
                <TypingIndicator />
              </>
            ) : (
              <span className="text-muted-foreground italic">
                Speak now in {selectedLanguageInfo?.nativeName || "your language"}...
              </span>
            )}
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
