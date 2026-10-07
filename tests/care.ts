import { type Page, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";

import { PLUGIN_SLUG, VISION_PRESCRIPTION_TYPE } from "../src/lib/constants";
import { PRESCRIPTION_DETAILS_SCHEMA, VISION_SCHEMA } from "../src/lib/group";

const fixtureSchema = z.object({
  facilityId: z.string(),
  facilityName: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  encounterId: z.string(),
  questionnaireId: z.string(),
  questionnaireSlug: z.string(),
  questionId: z.string(),
  fillPath: z.string(),
});
export type CareFixture = z.infer<typeof fixtureSchema>;

function requireLocal(url: string): void {
  const { hostname } = new URL(url);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(hostname) &&
    !hostname.endsWith(".localhost")
  ) {
    throw new Error("Use a local Care instance for these tests.");
  }
}

function environment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before you run the Care tests.`);
  return value;
}

export async function connectCare(page: Page) {
  requireLocal(environment("CARE_URL"));
  await page.goto("/");
  await page.getByText("Log in as Staff", { exact: true }).click();
  await page
    .getByLabel("Username", { exact: true })
    .fill(environment("CARE_USERNAME"));
  await page
    .getByLabel("Password", { exact: true })
    .fill(environment("CARE_PASSWORD"));
  const login = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/auth/"),
  );
  await page.getByRole("button", { name: "Login", exact: true }).click();
  expect((await login).ok()).toBe(true);
  await expect(page.getByLabel("Username", { exact: true })).toHaveCount(0);

  const connection = await page.evaluate(() => {
    const api: unknown = Reflect.get(window, "CARE_API_URL");
    return { api, token: localStorage.getItem("care_access_token") };
  });
  if (typeof connection.api !== "string" || !connection.token) {
    throw new Error("Care did not supply an authenticated API connection.");
  }
  requireLocal(connection.api);
  const api = connection.api;
  const token = connection.token;

  async function call(
    path: string,
    data?: unknown,
    method = data ? "POST" : "GET",
  ): Promise<unknown> {
    const response = await page.request.fetch(`${api}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      data,
    });
    if (!response.ok()) {
      throw new Error(
        `Care request failed: ${path}. HTTP ${response.status()}. ${response.headers()["content-type"]?.includes("application/json") ? await response.text() : response.statusText()}`,
      );
    }
    return response.json();
  }

  if (process.env.CARE_LOCAL_PLUGIN === "1") return { api, call };

  const remote =
    process.env.CARE_REMOTE_URL ??
    "http://localhost:4178/assets/remoteEntry.js";
  requireLocal(remote);
  const entry = await page.request.get(remote);
  expect(entry.status()).toBe(200);
  expect(entry.headers()["access-control-allow-origin"]).toBe("*");
  expect(await entry.text()).toContain("./manifest");

  const configs = z
    .object({
      configs: z.array(
        z.object({
          slug: z.string(),
          meta: z.object({ url: z.string().optional() }),
        }),
      ),
    })
    .parse(await call("/api/v1/plug_config/"));
  const existing = configs.configs.find(
    (config) => config.slug === PLUGIN_SLUG,
  );
  if (existing && existing.meta.url !== remote) {
    throw new Error(
      "The current plug URL differs from CARE_REMOTE_URL. Do not overwrite it.",
    );
  }
  if (!existing) {
    await call("/api/v1/plug_config/", {
      slug: PLUGIN_SLUG,
      meta: { url: remote },
    });
  }
  return { api, call };
}

export async function prepareFixture(
  call: (path: string, data?: unknown, method?: string) => Promise<unknown>,
): Promise<CareFixture> {
  const fixturePath = process.env.CARE_FIXTURE_PATH;
  if (fixturePath) {
    const fixture = fixtureSchema.parse(
      JSON.parse(await readFile(fixturePath, "utf8")),
    );
    const patient = z
      .object({ name: z.string() })
      .parse(await call(`/api/v1/patient/${fixture.patientId}/`));
    if (!patient.name.startsWith("Vision plug check ")) {
      throw new Error(
        "The supplied patient is not a Vision plug check record.",
      );
    }
    return fixture;
  }

  const list = z
    .object({
      results: z.array(z.object({ id: z.string(), name: z.string() })),
    })
    .parse(await call("/api/v1/facility/?limit=100"));
  const facility = process.env.CARE_FACILITY_ID
    ? list.results.find((item) => item.id === process.env.CARE_FACILITY_ID)
    : list.results.find((item) => /facility with patients/i.test(item.name));
  if (!facility)
    throw new Error("Set CARE_FACILITY_ID to a local test facility.");
  const details = z
    .object({
      geo_organization: z.object({ id: z.string() }),
    })
    .parse(await call(`/api/v1/facility/${facility.id}/`));
  const stamp = Date.now();
  const patient = z.object({ id: z.string(), name: z.string() }).parse(
    await call("/api/v1/patient/", {
      name: `Vision plug check ${stamp}`,
      gender: "female",
      phone_number: "+12025550100",
      date_of_birth: "1990-02-03",
      geo_organization: details.geo_organization.id,
      identifiers: [],
    }),
  );
  const encounter = z.object({ id: z.string() }).parse(
    await call("/api/v1/encounter/", {
      patient: patient.id,
      facility: facility.id,
      status: "in_progress",
      priority: "routine",
      encounter_class: "amb",
      period: { start: new Date().toISOString() },
      organizations: [],
    }),
  );
  const questionnaire = z
    .object({
      id: z.string(),
      slug: z.string(),
      questions: z.array(z.object({ id: z.string() })),
    })
    .parse(
      await call("/api/v1/questionnaire/", {
        title: "Vision Prescription check",
        slug: `vision-plug-${stamp}`,
        version: "0.1.0",
        status: "active",
        subject_type: "encounter",
        auth_context: "instance",
        actions: [],
        questions: [
          {
            id: randomUUID(),
            link_id: "vision",
            text: "Vision Prescription",
            type: "group",
            repeats: true,
            structured_type: VISION_PRESCRIPTION_TYPE,
            questions: VISION_SCHEMA.map((child) => ({
              ...child,
              id: randomUUID(),
              link_id: `vision__${child.link_id}`,
            })),
          },
          {
            id: randomUUID(),
            link_id: "details",
            text: "Vision prescription details",
            type: "group",
            structured_type: `${PLUGIN_SLUG}.prescription_details`,
            questions: PRESCRIPTION_DETAILS_SCHEMA.map((child) => ({
              ...child,
              id: randomUUID(),
              link_id: `details__${child.link_id}`,
            })),
          },
        ],
      }),
    );
  return {
    facilityId: facility.id,
    facilityName: facility.name,
    patientId: patient.id,
    patientName: patient.name,
    encounterId: encounter.id,
    questionnaireId: questionnaire.id,
    questionnaireSlug: questionnaire.slug,
    questionId: questionnaire.questions[0].id,
    fillPath: `/facility/${facility.id}/patient/${patient.id}/encounter/${encounter.id}/questionnaire/${questionnaire.id}`,
  };
}
