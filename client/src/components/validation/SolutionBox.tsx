/**
 * SolutionBox - Display solution/action recommendations
 * Based on VALIDATION_RESULT_DISPLAY_FRAMEWORK.md Part 7.3
 */

import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, AlertTriangle, Info, TrendingUp } from "lucide-react";
import { SolutionBoxProps } from "@/types/validation";
import { getSeverityStyle } from "./severityStyles";

export function SolutionBox({ solution, severity }: SolutionBoxProps) {
  const style = getSeverityStyle(severity);

  // Choose icon based on severity
  const Icon = severity === "error"
    ? AlertTriangle
    : severity === "optimization"
    ? TrendingUp
    : severity === "warning"
    ? AlertTriangle
    : Info;

  // Get severity-specific labels
  const labels = {
    error: "Action requise",
    warning: "Action recommandée",
    optimization: "Opportunité d'optimisation",
    info: "Information",
  };

  return (
    <Card className={`${style.background} ${style.border} border-l-4`}>
      <CardContent className="pt-4">
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <Lightbulb className={`w-4 h-4 ${style.iconColor}`} />
            <span className={style.headerText}>{labels[severity]}</span>
          </div>

          {/* Solution Content */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Icon className={`w-5 h-5 ${style.iconColor}`} />
            </div>
            <div className="flex-1">
              <p className={`text-sm leading-relaxed ${style.headerText}`}>
                {solution}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
