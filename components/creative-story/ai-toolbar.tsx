"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Wand2,
  Languages,
  SpellCheck,
  Expand,
  RefreshCw,
  Lightbulb,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिंदी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
];

const TONE_OPTIONS = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "poetic", label: "Poetic" },
  { value: "narrative", label: "Narrative" },
];

export type AIAction = "rewrite" | "grammar" | "expand" | "translate" | "suggest";

interface CreativeAIToolbarProps {
  onAction: (action: AIAction, options?: { targetLanguage?: string; tone?: string }) => Promise<void>;
  disabled?: boolean;
  isProcessing?: boolean;
  currentAction?: AIAction | null;
  hasContent: boolean;
  className?: string;
}

export function CreativeAIToolbar({
  onAction,
  disabled = false,
  isProcessing = false,
  currentAction = null,
  hasContent,
  className,
}: CreativeAIToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = async (action: AIAction, options?: { targetLanguage?: string; tone?: string }) => {
    setIsOpen(false);
    await onAction(action, options);
  };

  const isDisabled = disabled || isProcessing || !hasContent;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleAction("grammar")}
              disabled={isDisabled}
              className="h-8 px-2"
            >
              {isProcessing && currentAction === "grammar" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SpellCheck className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Improve grammar</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleAction("expand")}
              disabled={isDisabled}
              className="h-8 px-2"
            >
              {isProcessing && currentAction === "expand" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Expand className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Expand content</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isDisabled}
                  className="h-8 px-2"
                >
                  {isProcessing && currentAction === "rewrite" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Rewrite content</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Rewrite with tone</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TONE_OPTIONS.map((tone) => (
              <DropdownMenuItem
                key={tone.value}
                onClick={() => handleAction("rewrite", { tone: tone.value })}
              >
                {tone.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isDisabled}
                  className="h-8 px-2"
                >
                  {isProcessing && currentAction === "translate" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Languages className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Translate to Indian language</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
            <DropdownMenuLabel>Translate to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SUPPORTED_LANGUAGES.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleAction("translate", { targetLanguage: lang.code })}
              >
                <span className="mr-2">{lang.nativeName}</span>
                <span className="text-muted-foreground text-xs">({lang.name})</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleAction("suggest")}
              disabled={isDisabled}
              className="h-8 px-2"
            >
              {isProcessing && currentAction === "suggest" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Get AI suggestions</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isDisabled}
              className="h-8 gap-1"
            >
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">AI Assist</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>AI Writing Tools</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={() => handleAction("grammar")}>
              <SpellCheck className="h-4 w-4 mr-2" />
              Improve Grammar
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => handleAction("expand")}>
              <Expand className="h-4 w-4 mr-2" />
              Expand Content
            </DropdownMenuItem>
            
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <RefreshCw className="h-4 w-4 mr-2" />
                Rewrite
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {TONE_OPTIONS.map((tone) => (
                  <DropdownMenuItem
                    key={tone.value}
                    onClick={() => handleAction("rewrite", { tone: tone.value })}
                  >
                    {tone.label} tone
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Languages className="h-4 w-4 mr-2" />
                Translate
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-[250px] overflow-y-auto">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => handleAction("translate", { targetLanguage: lang.code })}
                  >
                    {lang.nativeName} ({lang.name})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={() => handleAction("suggest")}>
              <Lightbulb className="h-4 w-4 mr-2" />
              Get Suggestions
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}

export default CreativeAIToolbar;
