"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, X, RefreshCw, Loader2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AISuggestionsPanelProps {
  suggestions: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  onClose: () => void;
  className?: string;
}

export function AISuggestionsPanel({
  suggestions,
  isLoading,
  onRefresh,
  onClose,
  className,
}: AISuggestionsPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Parse suggestions into array
  const suggestionList = suggestions
    ? suggestions
        .split(/\d+\.\s+/)
        .filter((s) => s.trim())
        .map((s) => s.trim())
    : [];

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!suggestions && !isLoading) {
    return null;
  }

  return (
    <Card className={cn("border-primary/20 bg-primary/5", className)}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <CardTitle className="text-sm font-medium">AI Suggestions</CardTitle>
            <Badge variant="secondary" className="text-xs">
              Beta
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-7 w-7 p-0"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-7 w-7 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Consider these ideas to enhance your story
        </CardDescription>
      </CardHeader>
      <CardContent className="py-2 px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Generating suggestions...
            </span>
          </div>
        ) : suggestionList.length > 0 ? (
          <ul className="space-y-2">
            {suggestionList.map((suggestion, idx) => (
              <li
                key={idx}
                className="group flex items-start gap-2 text-sm text-muted-foreground rounded-md p-2 hover:bg-background/50 transition-colors"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                  {idx + 1}
                </span>
                <span className="flex-1">{suggestion}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(suggestion, idx)}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedIndex === idx ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            No suggestions available. Try adding more content first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default AISuggestionsPanel;
