"use client";

import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_TTS_LANGUAGES as SUPPORTED_LANGUAGES } from "@/lib/ai/constants";
import { Languages } from "lucide-react";

interface LanguageSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function LanguageSelector({ 
  value, 
  onValueChange, 
  disabled = false, 
  placeholder = "Select language",
  className = ""
}: LanguageSelectorProps) {
  const selectedLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={`w-[200px] ${className}`}>
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4" />
          <SelectValue placeholder={placeholder}>
            {selectedLanguage ? (
              <span>
                {selectedLanguage.nativeName} ({selectedLanguage.name})
              </span>
            ) : (
              placeholder
            )}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((language) => (
          <SelectItem key={language.code} value={language.code}>
            <div className="flex items-center justify-between w-full">
              <span className="font-medium">{language.nativeName}</span>
              <span className="text-sm text-gray-500 ml-2">{language.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}