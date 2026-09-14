# Vision Prescription

This CARE MFE plug adds a **Vision Prescription** structured question.
It stores spectacle and contact lens values in an encounter questionnaire response.
It does not need a backend plug.

The type ID is `care_vision_prescription_fe.vision_prescription`.
The host must support `structuredQuestionTypes` with `persistence: "response"`.
The local `care_dental_fe` plug supplies the reference for this contract.

## Record a prescription

1. Add a **Vision Prescription** question in the questionnaire studio.
2. Use an encounter questionnaire.
3. Open the questionnaire within a patient encounter.
4. Enter values for the required eyes and lens types.
5. Select the prescription status.
6. Review the values.
7. Submit the questionnaire.

Each table shows the right eye (OD) above the left eye (OS).
The spectacle table comes first.
The contact tables follow it.
Blank fields do not mean zero.
Enter `0` for a plano lens.

The question has these fields:

| Area | Fields |
| --- | --- |
| Prescription | Status, date written, note |
| Spectacles | Sphere, cylinder, axis, add, horizontal prism, vertical prism |
| Contact lenses | Power, cylinder, axis, add, both prism axes, back curve, diameter, wear duration, colour, brand |
| Context | Patient, encounter, facility, prescriber |

Care supplies the context.
The plug records the current user as the prescriber when the user first edits the answer.
A saved answer retains that prescriber.
The read-only view does not substitute the current user.

The initial status is **Draft**.
Draft, cancelled, and entered-in-error prescriptions show a notice against lens supply.
The plug does not create an electronic signature.

## Clinical checks

- Use steps of `0.25 D` for sphere, cylinder, add, and contact power.
- Supply an axis for every cylinder value, including `0`.
- Supply a cylinder for every axis.
- Use a whole axis value from `0` to `180` degrees.
- Supply the prism amount and base together.
- Use a prism amount of `0` or more.
- Use no more than `1` prism on each axis for each lens.
- Use positive back curve, diameter, and wear duration values.
- Supply a duration unit with the wear duration.
- Supply a sphere or power for each lens entry.
- Use a valid date that is not after today.

The plug does not set an arbitrary upper limit for optical power.
It does not transpose cylinders or copy values between eyes.
It does not select a prism base.
Incomplete numeric text stays in the draft and blocks submit.
The plug never converts an empty numeric field to `0`.

**Caution:** The backend stores this structured answer without clinical validation.
The plug validates the form before submit.
Direct API clients must enforce the same rules.

## Read, compare, and print

Care shows the saved answer in its encounter response views.
Use **Earlier prescriptions** within the question to read prior answers for the patient.
Use **Check earlier responses** to request the next page.
The list retains the entries from earlier pages.
The plug does not silently copy historical values into a new prescription.

Use the Care print action for a saved questionnaire response.
Care supplies the facility header and patient details.
The plug supplies the optical tables, note, and signature block.
The print view retains the prescription status.

Care owns the response history.
This plug does not add a separate timeline resource or a separate prescription API.

## Data contract

The answer uses field names and value types from
[FHIR VisionPrescription](https://build.fhir.org/visionprescription.html).
The linked FHIR page is a continuous build.
This plug uses its `dateWritten` field.
The answer is **not** a standalone FHIR resource.
Care context IDs are not FHIR resource references.

The component sends `response.values[0].value` as an array with `1` prescription.
The host converts that array to JSON text for the backend.
The host decodes the text before it mounts a read-only component.

```json
{
  "schemaVersion": 1,
  "status": "active",
  "created": "2026-09-12T10:00:00Z",
  "dateWritten": "2026-09-12",
  "context": {
    "patientId": "<care-patient-id>",
    "encounterId": "<care-encounter-id>",
    "facilityId": "<care-facility-id>",
    "prescriber": {
      "id": "<care-user-id>",
      "display": "<prescriber-name>"
    }
  },
  "lensSpecification": [
    {
      "product": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/ex-visionprescriptionproduct",
            "code": "lens"
          }
        ]
      },
      "eye": "right",
      "sphere": -2.25,
      "cylinder": -0.75,
      "axis": 90,
      "add": 1.5,
      "prism": [{ "amount": 1.5, "base": "out" }]
    }
  ]
}
```

The example shows the prescription object inside the array.
The general note stays in `response.note`.
Product code `lens` identifies spectacles.
Product code `contact` identifies contact lenses.
Prism bases are `in`, `out`, `up`, and `down`.
Duration quantities use UCUM codes `h`, `d`, `wk`, and `mo`.

A draft can contain incomplete numeric text.
A prism draft can contain `draftPlane` until the user selects a base.
Submit validation rejects both incomplete states.
The plug rejects unknown schema versions instead of discarding their fields.

`src/types/host.ts` mirrors the host contract.
The manifest declares `requires: []` so the studio can show the form without a patient.
Submit validation still requires a patient, encounter, and prescriber.
The manifest restricts the question to encounter questionnaires.

## Local use

Install the dependencies:

```sh
npm install
```

Build the remote:

```sh
npm run build
```

Start the remote preview in your terminal:

```sh
npm run preview
```

The remote URL is:

```text
http://localhost:4178/assets/remoteEntry.js
```

Add the remote through the local Care app configuration.
Use slug `care_vision_prescription_fe` and the URL above.
Do not enrol this local build in the CARE App Store.

For an isolated form preview, run:

```sh
npm run dev
```

The isolated preview uses sample context.
It does not save clinical records.
The production build excludes that preview.

## Source

| Path | Purpose |
| --- | --- |
| `src/manifest.tsx` | Structured-question registration |
| `src/lib/prescription.ts` | Answer schema and field updates |
| `src/lib/validate.ts` | Clinical checks and host errors |
| `src/lib/history.ts` | Stored answer decode and pagination |
| `src/components/vision-prescription/` | Form, read-only tables, history, print content |
| `src/style/` | Care UI tokens with a plug-specific scope |
| `public/locale/en.json` | English text |

The MFE uses the `care_teleicu_devices_fe` chassis.
It uses Vite `6` for the federation build.
Care UI supplies the components and theme.
The stylesheet stays within `.care-vision-prescription-fe`.
The plug does not change the host font or host layout.
Numeric fields use a monospace font.

## Checks

Run the local checks:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Check the remote after you start the preview:

```sh
curl -I http://localhost:4178/assets/remoteEntry.js
```

The response must have status `200` and `Access-Control-Allow-Origin: *`.
A successful build alone does not prove that Care can load the remote.

## License

MIT.
