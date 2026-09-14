import { expect, test } from "@playwright/test";
import { z } from "zod";

import { historyPageSchema } from "../src/lib/history";
import { prescriptionSchema } from "../src/lib/prescription";
import { connectCare, prepareFixture } from "./care";

test("record, restore, read, compare, and print a prescription in Care", async ({ page }, testInfo) => {
  const connection = await connectCare(page);
  const fixture = await prepareFixture(connection.call);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(fixture.fillPath);
  const question = page.locator(".vision-question");
  await expect(question).toBeVisible();
  await expect(question.getByRole("heading", { name: "Spectacles", exact: true })).toBeVisible();
  const optical = question.getByRole("table", { name: "Spectacles", exact: true });
  await expect(optical.getByRole("rowheader")).toHaveText([/Right eye.*OD/, /Left eye.*OS/]);

  const number = (product: string, eye: string, field: string) =>
    question.getByRole("textbox", { name: `${product}, ${eye}, ${field}`, exact: true });
  const rightSphere = number("Spectacles", "Right eye", "Sphere (D)");
  await rightSphere.fill("-2.25");
  await rightSphere.press("Tab");
  await expect(rightSphere).toHaveValue("-2.25");
  await number("Spectacles", "Left eye", "Sphere (D)").fill("0");
  const cylinder = number("Spectacles", "Right eye", "Cylinder (D)");
  await cylinder.fill("-0.75");
  await cylinder.press("Tab");

  let submitRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/batch_requests/")) submitRequests += 1;
  });
  await page.getByRole("button", { name: /^save changes$/i }).click();
  await expect(question.getByText("Enter an axis for the cylinder.", { exact: true })).toBeVisible();
  expect(submitRequests).toBe(0);

  const axis = number("Spectacles", "Right eye", "Axis (degrees)");
  await axis.fill("181");
  await axis.press("Tab");
  await expect(axis).toHaveAttribute("aria-invalid", "true");
  await axis.fill("90");
  await number("Spectacles", "Right eye", "Add (D)").fill("1.5");
  await number("Spectacles", "Right eye", "Horizontal prism (PD) Amount").fill("1.5");
  await question.getByRole("combobox", { name: "Spectacles, Right eye, Horizontal prism (PD) Base", exact: true }).selectOption("out");
  await number("Spectacles", "Right eye", "Vertical prism (PD) Amount").fill("0.5");
  await question.getByRole("combobox", { name: "Spectacles, Right eye, Vertical prism (PD) Base", exact: true }).selectOption("up");
  await number("Contact lenses", "Right eye", "Power (D)").fill("-2.25");
  await number("Contact lenses", "Right eye", "Back curve (mm)").fill("8.6");
  await number("Contact lenses", "Right eye", "Diameter (mm)").fill("14.2");
  await number("Contact lenses", "Right eye", "Wear duration").fill("8");
  await question.getByRole("combobox", { name: "Contact lenses, Right eye, Duration unit", exact: true }).selectOption("h");
  await question.getByRole("textbox", { name: "Contact lenses, Right eye, Colour", exact: true }).fill("Brown");
  await question.getByRole("textbox", { name: "Contact lenses, Right eye, Brand", exact: true }).fill("Local test lens");
  await question.getByRole("combobox", { name: "Status", exact: true }).selectOption("active");
  const note = `Local plug check ${Date.now()}. Do not dispense.`;
  await question.getByRole("textbox", { name: "Prescription note", exact: true }).fill(note);

  await page.getByRole("button", { name: /^save as draft$/i }).click();
  await page.goto(fixture.fillPath);
  const restore = page.getByRole("button", { name: /restore|resume/i }).first();
  if (await restore.isVisible()) await restore.click();
  await expect(rightSphere).toHaveValue("-2.25");
  await expect(number("Spectacles", "Left eye", "Sphere (D)")).toHaveValue("+0.00");
  await expect(question.getByRole("textbox", { name: "Prescription note", exact: true })).toHaveValue(note);

  const light = await question.evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect.poll(() => question.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(light);
  await question.screenshot({ path: testInfo.outputPath("form-dark.png") });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await question.screenshot({ path: testInfo.outputPath("form-light.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await question.boundingBox();
  expect(bounds).not.toBeNull();
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(391);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const submit = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/batch_requests/"),
  );
  await page.getByRole("button", { name: /^save changes$/i }).click();
  expect((await submit).ok()).toBe(true);

  const responses = historyPageSchema.parse(await connection.call(
    `/api/v1/patient/${fixture.patientId}/questionnaire_response/?encounter=${fixture.encounterId}&questionnaire=${fixture.questionnaireId}`,
  ));
  const saved = responses.results.find((response) =>
    response.responses.some((answer) => answer.question_id === fixture.questionId && answer.note === note),
  );
  expect(saved).toBeDefined();
  if (!saved) throw new Error("Care did not store the prescription response.");
  const stored = saved.responses.find((answer) => answer.question_id === fixture.questionId);
  const raw = z.string().parse(stored?.values[0]?.value);
  const decoded = z.tuple([prescriptionSchema]).parse(JSON.parse(raw))[0];
  expect(decoded.context?.patientId).toBe(fixture.patientId);
  expect(decoded.context?.encounterId).toBe(fixture.encounterId);
  expect(decoded.context?.prescriber?.display).toBeTruthy();
  expect(decoded.status).toBe("active");
  expect(decoded.lensSpecification).toHaveLength(3);
  const spectacle = decoded.lensSpecification.find((lens) => lens.product.coding[0].code === "lens" && lens.eye === "right");
  expect(spectacle).toMatchObject({
    sphere: -2.25, cylinder: -0.75, axis: 90, add: 1.5,
    prism: [{ amount: 1.5, base: "out" }, { amount: 0.5, base: "up" }],
  });
  expect(decoded.lensSpecification.find((lens) => lens.product.coding[0].code === "lens" && lens.eye === "left")?.sphere).toBe(0);
  expect(decoded.lensSpecification.find((lens) => lens.product.coding[0].code === "contact")).toMatchObject({
    power: -2.25, backCurve: 8.6, diameter: 14.2,
    duration: { value: 8, code: "h", unit: "hours", system: "http://unitsofmeasure.org" },
    color: "Brown", brand: "Local test lens",
  });

  const responsePath = `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${fixture.encounterId}/questionnaire_response/${saved.id}`;
  await page.goto(responsePath);
  await expect(question.locator(".vision-summary")).toBeVisible();
  await expect(question.locator("input, textarea, select, button")).toHaveCount(0);
  await expect(question).toContainText("+0.00");
  await expect(question).toContainText(note);
  await expect(question).toContainText(decoded.context?.prescriber?.display ?? "");

  await page.goto(`${responsePath}/print`);
  await expect(question.locator(".vision-signature")).toBeVisible();
  await expect(page.getByText(fixture.facilityName, { exact: false }).first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(question).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(question.locator(".vision-signature")).toBeVisible();
  await page.pdf({ path: testInfo.outputPath("vision-prescription.pdf"), format: "A4", printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));

  await page.goto(fixture.fillPath);
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "Earlier prescriptions", exact: true }).click();
  const previous = question.locator(".vision-history details").filter({ hasText: "Active" }).first();
  await expect(previous).toBeVisible();
  await previous.locator("summary").click();
  await expect(previous).toContainText(note);
  await expect(previous).toContainText("-2.25");
  await expect(previous).toContainText("1.5 Out");
  expect(pageErrors).toEqual([]);
});
