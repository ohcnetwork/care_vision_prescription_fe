/**
 * Host contract subset. Keep in sync with care_fe/src/pluginTypes.ts,
 * components/QuestionnaireV2/structured/{pluginRegistry,types}.ts, and
 * types/questionnaire/{form,question,batch,questionnaire}.ts.
 * Mirrored from care_dental_fe at b582ec644ecf3986c6de73a2f0a3ab2e69edc7ae.
 */
import type { ComponentType } from "react";

export interface Code {
  code: string;
  display?: string;
  system?: string;
}

export interface Question {
  id: string;
  link_id: string;
  text: string;
  description?: string;
  type: string;
  structured_type?: string;
  required?: boolean;
  read_only?: boolean;
}

export interface ResponseValue {
  type: string;
  value?: unknown;
  coding?: Code;
  unit?: Code;
}

export interface QuestionnaireResponse {
  question_id: string;
  structured_type: string | null;
  link_id: string;
  values: ResponseValue[];
  note?: string;
}

export interface QuestionValidationError {
  question_id: string;
  error?: string;
  msg?: string;
  type?: string;
}

export type SubjectType =
  "patient" | "encounter" | "location" | "device" | "facility";

export type StructuredContextKey = "patientId" | "encounterId" | "facilityId";

export interface StructuredInputProps {
  question: Question;
  response: QuestionnaireResponse;
  onChange: (values: ResponseValue[], note?: string) => void;
  onInitializeResponse?: (values: ResponseValue[]) => void;
  disabled: boolean;
  errors: QuestionValidationError[];
  clearError: () => void;
  patientId?: string;
  encounterId?: string;
  facilityId?: string;
  questionnaireId?: string;
  questionnaireSlug?: string;
}

export interface StructuredBatchEntry {
  url: string;
  method: "POST" | "PUT" | "PATCH";
  reference_id: string;
  body: unknown;
}

export interface StructuredRequestContext {
  patientId?: string;
  encounterId?: string;
  facilityId?: string;
  questionId: string;
}

export type StructuredRequestBuilder = (
  data: unknown[],
  context: StructuredRequestContext,
) => Promise<StructuredBatchEntry[]>;

export type PluginStructuredPersistence =
  | { persistence?: "batch"; buildRequests: StructuredRequestBuilder }
  | { persistence: "response"; buildRequests?: undefined };

export type PluginStructuredTypeDefinition = {
  type: string;
  component: ComponentType<StructuredInputProps>;
  requires: readonly StructuredContextKey[];
  subjects: readonly SubjectType[];
  draftPolicy: "serialize" | "exclude";
  label: string;
  icon?: ComponentType<{ className?: string }>;
  validate?: (
    data: unknown[],
    questionId: string,
    required: boolean,
  ) => QuestionValidationError[];
} & PluginStructuredPersistence;

export interface PluginManifest {
  plugin: string;
  structuredQuestionTypes?: readonly PluginStructuredTypeDefinition[];
}
