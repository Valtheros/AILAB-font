"use client";

import { useLanguage } from "@/components/language-provider";
import type { TranslationKey } from "@/lib/i18n";

export function I18nText({ textKey }: { textKey: TranslationKey }) {
  const { t } = useLanguage();
  return <>{t(textKey)}</>;
}
