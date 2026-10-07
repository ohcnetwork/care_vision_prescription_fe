import { expect, test } from "@playwright/test";
import { z } from "zod";

import { connectCare, prepareFixture } from "./care";

test("record, restore, read, and print a prescription group in Care", async ({
  page,
}, testInfo) => {
  const connection = await connectCare(page);
  const fixture = await prepareFixture(connection.call);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(fixture.fillPath);
  const question = page.locator(".vision-question");
  await expect(question).toBeVisible();
  await expect(
    question.getByRole("heading", { name: "Spectacles", exact: true }),
  ).toBeVisible();
  const optical = question.getByRole("table", {
    name: "Spectacles",
    exact: true,
  });
  await expect(optical.getByRole("rowheader")).toHaveText([
    /Right eye.*OD/,
    /Left eye.*OS/,
  ]);

  const number = (product: string, eye: string, field: string) =>
    question.getByRole("textbox", {
      name: `${product}, ${eye}, ${field}`,
      exact: true,
    });
  const rightSphere = number("Spectacles", "Right eye", "Sphere (D)");
  await rightSphere.fill("-2.25");
  await rightSphere.press("Tab");
  await expect(rightSphere).toHaveValue("-2.25");
  await number("Spectacles", "Left eye", "Sphere (D)").fill("0");
  const cylinder = number("Spectacles", "Right eye", "Cylinder (D)");
  await cylinder.fill("-0.75");
  await cylinder.press("Tab");

  const axis = number("Spectacles", "Right eye", "Axis (°)");
  await axis.fill("90");
  await number("Spectacles", "Right eye", "Add (D)").fill("1.5");
  await question
    .getByRole("button", { name: "Prism", exact: true })
    .first()
    .click();
  await number("Spectacles", "Right eye", "Horizontal prism (PD) Amount").fill(
    "1.5",
  );
  await question
    .getByRole("combobox", {
      name: "Spectacles, Right eye, Horizontal prism (PD) Base",
      exact: true,
    })
    .selectOption("out");
  await number("Spectacles", "Right eye", "Vertical prism (PD) Amount").fill(
    "0.5",
  );
  await question
    .getByRole("combobox", {
      name: "Spectacles, Right eye, Vertical prism (PD) Base",
      exact: true,
    })
    .selectOption("up");
  await number("Contact lenses", "Right eye", "Power (D)").fill("-2.25");
  await question
    .getByRole("button", { name: "Contact lens details", exact: true })
    .click();
  await number("Contact lenses", "Right eye", "Back curve (mm)").fill("8.6");
  await number("Contact lenses", "Right eye", "Diameter (mm)").fill("14.2");
  await number("Contact lenses", "Right eye", "Wear duration").fill("8");
  await question
    .getByRole("combobox", {
      name: "Contact lenses, Right eye, Duration unit",
      exact: true,
    })
    .selectOption("h");
  await question
    .getByRole("textbox", {
      name: "Contact lenses, Right eye, Colour",
      exact: true,
    })
    .fill("Brown");
  await question
    .getByRole("textbox", {
      name: "Contact lenses, Right eye, Brand",
      exact: true,
    })
    .fill("Local test lens");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("active");
  await page
    .getByRole("textbox", { name: "Date written", exact: true })
    .fill("2026-09-27T10:30");
  const note = `Local plug check ${Date.now()}. Do not dispense.`;
  await question
    .getByRole("textbox", {
      name: "Spectacles, Right eye, Lens note",
      exact: true,
    })
    .fill(note);

  const draftResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/form_submission/"),
  );
  await page.getByRole("button", { name: /^save as draft$/i }).click();
  const draft = await draftResponse;
  expect(draft.ok()).toBe(true);
  const savedDraft = z.object({ id: z.string() }).parse(await draft.json());
  await page.waitForURL(
    (url) =>
      !url.pathname.includes(`/questionnaire/${fixture.questionnaireId}`),
  );
  await page.goto(`${fixture.fillPath}?continue_draft=${savedDraft.id}`);
  await expect(rightSphere).toHaveValue("-2.25");
  await expect(number("Spectacles", "Left eye", "Sphere (D)")).toHaveValue(
    "+0.00",
  );
  await expect(
    question.getByRole("textbox", {
      name: "Spectacles, Right eye, Lens note",
      exact: true,
    }),
  ).toHaveValue(note);

  const light = await question.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect
    .poll(() =>
      question.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(light);
  await question.screenshot({ path: testInfo.outputPath("form-dark.png") });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await question.screenshot({ path: testInfo.outputPath("form-light.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await question.boundingBox();
  expect(bounds).not.toBeNull();
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(391);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const submit = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/batch_requests/"),
  );
  await page.getByRole("button", { name: /^save changes$/i }).click();
  expect((await submit).ok()).toBe(true);

  const responses = z
    .object({
      results: z.array(
        z.object({
          id: z.string(),
          responses: z.array(
            z.object({
              sub_results: z
                .array(
                  z.array(
                    z.object({
                      question_id: z.string(),
                      values: z
                        .array(z.object({ value: z.unknown() }))
                        .default([]),
                    }),
                  ),
                )
                .default([]),
              question_id: z.string(),
              values: z.array(z.object({ value: z.unknown() })).default([]),
            }),
          ),
          questionnaire: z.object({
            questions: z.array(
              z.object({
                id: z.string(),
                type: z.string(),
                questions: z.array(
                  z.object({ id: z.string(), link_id: z.string() }),
                ),
              }),
            ),
          }),
        }),
      ),
    })
    .parse(
      await connection.call(
        `/api/v1/patient/${fixture.patientId}/questionnaire_response/?encounter=${fixture.encounterId}&questionnaire=${fixture.questionnaireId}`,
      ),
    );
  const saved = responses.results.find((response) =>
    response.responses.some((answer) =>
      answer.sub_results.some((row) =>
        row.some((child) => child.values.some(({ value }) => value === note)),
      ),
    ),
  );
  expect(saved).toBeDefined();
  if (!saved) throw new Error("Care did not store the prescription response.");
  const group = saved.questionnaire.questions.find(
    ({ id }) => id === fixture.questionId,
  )!;
  expect(group.type).toBe("group");
  const answer = saved.responses.find(
    ({ question_id }) => question_id === fixture.questionId,
  )!;
  expect(answer.values).toEqual([]);
  const rows = answer.sub_results.map((row) =>
    Object.fromEntries(
      group.questions.map((child) => [
        child.link_id,
        row.find(({ question_id }) => question_id === child.id)?.values[0]
          ?.value,
      ]),
    ),
  );
  expect(rows).toHaveLength(3);
  expect(rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        vision__product: "lens",
        vision__eye: "right",
        vision__sphere: "-2.25",
        vision__cylinder: "-0.75",
        vision__axis: "90",
        vision__prism_horizontal_base: "out",
        vision__prism_vertical_amount: "0.5",
        vision__note: note,
      }),
      expect.objectContaining({
        vision__product: "lens",
        vision__eye: "left",
        vision__sphere: "0",
      }),
      expect.objectContaining({
        vision__product: "contact",
        vision__eye: "right",
        vision__power: "-2.25",
      }),
    ]),
  );

  const responsePath = `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${fixture.encounterId}/questionnaire_response/${saved.id}`;
  await page.goto(responsePath);
  await expect(question.locator(".vision-summary")).toBeVisible();
  await expect(question.locator("input, textarea, select, button")).toHaveCount(
    0,
  );
  await expect(question).toContainText("+0.00");
  await expect(question).toContainText(note);

  await page.goto(`${responsePath}/print`);
  await expect(question.locator(".vision-summary")).toBeVisible();
  await expect(
    page.getByText(fixture.facilityName, { exact: false }).first(),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(question).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(question.locator(".vision-summary")).toBeVisible();
  await page.pdf({
    path: testInfo.outputPath("vision-prescription.pdf"),
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));

  expect(pageErrors).toEqual([]);
});
