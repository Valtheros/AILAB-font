"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/language-provider";

export interface Insight {
  level: "danger" | "warning" | "success" | "info";
  code: string;
  params?: Record<string, string | number | null>;
}

const LEVEL_CLASSES: Record<Insight["level"], string> = {
  danger: "border-red-500/40 bg-red-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  success: "border-emerald-500/40 bg-emerald-500/5",
  info: "border-border bg-accent/30",
};

/** Fill {name} placeholders in the localized template from the item's params. */
function render(text: string, params?: Insight["params"]) {
  if (!params) return text;
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value === null || value === undefined ? "-" : String(value)),
    text,
  );
}

/**
 * Renders backend-computed, rule-based insights. The backend sends
 * {level, code, params}; the wording (and language) lives entirely in i18n
 * under `insight.*`, so nothing here is hard-coded English or Thai.
 */
export function InsightList({ insights, titleKey }: { insights: Insight[]; titleKey: string }) {
  const { t } = useLanguage();
  if (!insights?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5" />{t(titleKey)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((item, index) => (
          <div
            key={`${item.code}-${index}`}
            className={`rounded-md border p-3 text-sm leading-relaxed ${LEVEL_CLASSES[item.level] ?? LEVEL_CLASSES.info}`}
          >
            {render(t(`insight.${item.code}`), item.params)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
