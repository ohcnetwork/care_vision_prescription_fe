import type { Context } from "react";

export interface CareUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  prefix?: string | null;
  suffix?: string | null;
  qualification?: string | null;
  doctor_medical_council_registration?: string | null;
}

export interface CareAuthContext {
  user: CareUser | undefined;
}

// These properties belong to care_fe/src/index.tsx.
export interface CareRuntime {
  CARE_API_URL?: string;
  __CORE_ENV__?: { apiUrl: string };
  AuthUserContext?: Context<CareAuthContext | null>;
}

export function getCareRuntime(): CareRuntime {
  return typeof window === "undefined" ? {} : (window as Window & CareRuntime);
}
