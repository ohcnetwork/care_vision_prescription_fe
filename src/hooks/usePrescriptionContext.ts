import { createContext, useContext } from "react";

import type { Prescriber, PrescriptionContext } from "../lib/prescription";
import { type CareAuthContext, getCareRuntime } from "../types/care";

const EmptyAuthContext = createContext<CareAuthContext | null>(null);

export function usePrescriptionContext(
  patientId?: string,
  encounterId?: string,
  facilityId?: string,
): PrescriptionContext | undefined {
  const auth = useContext(getCareRuntime().AuthUserContext ?? EmptyAuthContext);
  if (!patientId || !encounterId) return undefined;

  const user = auth?.user;
  const prescriber: Prescriber | undefined = user
    ? {
        id: user.id,
        display:
          [user.prefix, user.first_name, user.last_name, user.suffix]
            .filter(Boolean)
            .join(" ")
            .trim() || user.username,
        qualification: user.qualification || undefined,
        registration: user.doctor_medical_council_registration || undefined,
      }
    : undefined;

  return { patientId, encounterId, facilityId, prescriber };
}
