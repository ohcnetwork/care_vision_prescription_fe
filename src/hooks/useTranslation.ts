import { useCallback } from "react";
import { useTranslation as useTranslationBase } from "react-i18next";

import en from "../../public/locale/en.json";

export const NAMESPACE = "care_vision_prescription_fe";

type Key = keyof typeof en;

export function useTranslation() {
  const { t: base, i18n } = useTranslationBase(NAMESPACE, {
    useSuspense: false,
  });
  const t = useCallback(
    (key: Key, options?: Record<string, unknown>) =>
      base(key, { defaultValue: en[key], ...options }),
    [base],
  );
  return { t, i18n };
}
