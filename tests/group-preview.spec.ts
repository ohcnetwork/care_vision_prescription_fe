import { expect, test } from "@playwright/test";

test("vision group writes ordinary answers and renders them read-only", async ({
  page,
}, testInfo) => {
  const url = process.env.VISION_PREVIEW_URL;
  test.skip(!url, "Set VISION_PREVIEW_URL to the isolated dev preview");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url!);
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("active");
  await page
    .getByLabel("Date written", { exact: true })
    .fill("2026-09-27T10:30");
  await expect(page.getByLabel("Date written", { exact: true })).toHaveValue(
    "2026-09-27T10:30",
  );
  const question = page.locator(".vision-question");
  const sphere = question.getByRole("textbox", {
    name: "Spectacles, Right eye, Sphere (D)",
    exact: true,
  });
  await sphere.fill("0");
  await sphere.press("Tab");
  await expect(sphere).toHaveValue("+0.00");
  await question
    .getByRole("textbox", {
      name: "Spectacles, Right eye, Cylinder (D)",
      exact: true,
    })
    .fill("-0.75");
  await question
    .getByRole("textbox", {
      name: "Spectacles, Right eye, Axis (°)",
      exact: true,
    })
    .fill("90");
  await question
    .getByRole("button", { name: "Prism", exact: true })
    .first()
    .click();
  await question
    .getByRole("textbox", {
      name: "Spectacles, Right eye, Horizontal prism (PD) Amount",
      exact: true,
    })
    .fill("1.5");
  await question
    .getByRole("combobox", {
      name: "Spectacles, Right eye, Horizontal prism (PD) Base",
      exact: true,
    })
    .selectOption("out");
  await question
    .getByRole("textbox", {
      name: "Spectacles, Right eye, Lens note",
      exact: true,
    })
    .fill("Group preview");
  const answers = JSON.parse(
    (await page.getByTestId("answer-data").textContent())!,
  );
  const values = Object.fromEntries(
    answers.sub_results[0].map(
      (answer: { link_id: string; values: { value: unknown }[] }) => [
        answer.link_id,
        answer.values[0]?.value,
      ],
    ),
  );
  expect(answers.sub_results).toHaveLength(1);
  expect(values).toMatchObject({
    product: "lens",
    eye: "right",
    sphere: 0,
    cylinder: -0.75,
    axis: 90,
    prism_horizontal_base: "out",
    note: "Group preview",
  });
  expect(values.power).toBeUndefined();
  expect(values.patientId).toBeUndefined();
  await page
    .getByRole("button", { name: "Read-only view", exact: true })
    .click();
  await expect(question.locator(".vision-summary")).toBeVisible();
  await expect(question.locator("input, select, textarea")).toHaveCount(0);
  await expect(question).toContainText("+0.00");
  await expect(question).toContainText("1.5 Out");
  await expect(question).toContainText("Group preview");
  await question.screenshot({
    path: testInfo.outputPath("group-readonly.png"),
  });
  await page.emulateMedia({ media: "print" });
  await expect(question).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.emulateMedia({ media: "screen" });
  await page
    .getByRole("button", { name: "Read-only view", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load sample values", exact: true })
    .click();
  expect(
    JSON.parse((await page.getByTestId("answer-data").textContent())!)
      .sub_results,
  ).toHaveLength(4);
  await question
    .getByRole("button", { name: "Clear question", exact: true })
    .click();
  await question
    .getByRole("alert")
    .getByRole("button", { name: "Clear question", exact: true })
    .click();
  expect(
    JSON.parse((await page.getByTestId("answer-data").textContent())!)
      .sub_results,
  ).toHaveLength(0);
  expect(errors).toEqual([]);
});
