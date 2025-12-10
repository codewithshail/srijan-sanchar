"use client";

import { cn } from "@/lib/utils";
import { LIFE_STAGES, type LifeStageId } from "@/lib/life-stages";
import { Check, Circle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StageNavigatorProps {
  currentStageId: LifeStageId;
  completedStages: LifeStageId[];
  onStageSelect: (stageId: LifeStageId) => void;
  savingStage?: LifeStageId | null;
  className?: string;
}

export function StageNavigator({
  currentStageId,
  completedStages,
  onStageSelect,
  savingStage,
  className,
}: StageNavigatorProps) {
  const completionPercentage = Math.round(
    (completedStages.length / LIFE_STAGES.length) * 100
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Progress Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Your Progress</span>
          <span className="text-sm text-muted-foreground">
            {completedStages.length}/{LIFE_STAGES.length} stages
          </span>
        </div>
        <Progress value={completionPercentage} className="h-2" />
        <p className="text-xs text-muted-foreground mt-1">
          {completionPercentage}% complete
        </p>
      </div>

      {/* Stage List */}
      <nav className="flex-1 overflow-y-auto p-2">
        <TooltipProvider>
          <ul className="space-y-1">
            {LIFE_STAGES.map((stage) => {
              const isCompleted = completedStages.includes(stage.id);
              const isCurrent = currentStageId === stage.id;
              const isSaving = savingStage === stage.id;

              return (
                <li key={stage.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onStageSelect(stage.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all",
                          "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                          isCurrent && "bg-primary/10 border border-primary/20",
                          !isCurrent && !isCompleted && "opacity-80"
                        )}
                      >
                        {/* Status Icon */}
                        <div
                          className={cn(
                            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg",
                            isCompleted && "bg-green-100 dark:bg-green-900/30",
                            isCurrent && !isCompleted && "bg-primary/20",
                            !isCurrent && !isCompleted && "bg-muted"
                          )}
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : isCompleted ? (
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <span>{stage.icon}</span>
                          )}
                        </div>

                        {/* Stage Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "font-medium text-sm truncate",
                                isCurrent && "text-primary"
                              )}
                            >
                              {stage.name}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground block truncate">
                            {stage.nativeName} ({stage.transliteration})
                          </span>
                        </div>

                        {/* Current Indicator */}
                        {isCurrent && (
                          <Circle className="h-2 w-2 fill-primary text-primary flex-shrink-0" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px]">
                      <p className="font-medium">{stage.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {stage.description}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          Fill stages in any order. You can submit with partial completion.
        </p>
      </div>
    </div>
  );
}

export default StageNavigator;
