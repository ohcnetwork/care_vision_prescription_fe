# Vision Prescription

See [SCHEMA.md](SCHEMA.md) for saved fields, validation rules, and submission examples.

A CARE registered question group for collecting spectacle and contact lens information with custom optical tables and value dials.

The schema follows [FHIR R4 VisionPrescription](https://hl7.org/fhir/R4/visionprescription.html). Add these two groups under **Group** in the questionnaire studio:

- **Vision prescription details** (`care_vision_prescription_fe.prescription_details`): non-repeating status choice and authorization `dateWritten` datetime.
- **Vision lens specifications** (`care_vision_prescription_fe.vision_prescription`): repeating `lensSpecification` rows with required product (`lens` / `contact`) and eye (`right` / `left`) choices.

## Recorded fields

Each lens row uses the same 18 child questions: product, eye, sphere, cylinder, axis, add, power, backCurve, diameter, prism amount/base for each plane, wear duration/unit, color, brand, and note. This replaces the previous 47 product/eye-specific child questions. A table cell creates a row when first answered, updates the matching product/eye row, and removes it when its last value is cleared. Zero is an answered plano value.

Lens rows submit through CARE's ordinary repeating-group `sub_results`; no prescription JSON blob is stored. `product` maps to a CodeableConcept using the example vision product code system, `eye` and prism bases use FHIR codes, duration maps to a UCUM quantity, and each row's text note maps to a lens Annotation. Status and authorization date remain separate from the lens rows.

The editor supports one lens per product/eye, one prism per horizontal/vertical plane and one note per lens. CARE registered groups currently disallow nested repeating groups, so the prism array is represented by two amount/base pairs. A full FHIR resource would additionally require verified patient/prescriber references and creation metadata; this plugin collects questionnaire answers and does not manufacture those references or submit a FHIR resource. Partial numeric/prism input remains a draft value, not a validated FHIR resource.

CARE owns ordinary-answer validation, drafts, submission, encounter association, response authorship, history and printing. Both groups register submission validators: lens rows reuse the optical checks for numeric steps, axis/cylinder pairs, prisms, contact fields and duplicate product/eye pairs; prescription details check status and valid, non-future calendar dates. These callbacks return errors for the saved child questions and row paths without requiring the legacy prescription envelope. Optical hints and transpose/copy controls remain available. Missing/protected child bindings make the visualization read-only; hidden values are excluded. Duplicate or unknown row identities display an invalid-answer message rather than choosing one silently.

## Existing questionnaires

Use the studio's explicit schema repair to switch an existing non-repeating registered group to lens rows, then add the prescription details group. Repair is for future collection; it does not migrate historical answers. Historical non-repeating responses use CARE's ordinary child-answer fallback so their saved values remain readable.

Older `type: "structured"` JSON prescriptions are not automatically migrated. Preserve those records and use new registered groups for future collection.

## Development

From this directory:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run guard
```

Place the repository as a real directory at `care_fe/apps/care_vision_prescription_fe`. Start the host with `portless`, or `npm run dev` when portless is unavailable. The host auto-discovers `src/manifest.tsx` and supplies HMR and locale assets.

`npm run dev` in this directory opens the isolated preview at port 4178. It uses local group bindings and makes no clinical API calls.

For a federated remote, run `npm run build` followed by `npm run preview`. The entry is `http://localhost:4178/assets/remoteEntry.js`. Enable it through the host's local configuration with slug `care_vision_prescription_fe`, or `REACT_ENABLED_APPS=ohcnetwork/care_vision_prescription_fe@localhost:4178/assets/remoteEntry.js`. In-tree discovery does not enable a production build.

The remote uses Vite 6, shared React/i18n packages, and CSS scoped to `.care-vision-prescription-fe`. Its production graph excludes the standalone preview. English translations live in `public/locale/en.json`.

## Integration checks

The backend flow in `tests/vision-prescription.spec.ts` creates a test group, fills ordinary child values, restores a draft, checks saved repeating rows, and opens readback/print. It requires a running local backend, a local host, and `CARE_URL`, `CARE_USERNAME`, `CARE_PASSWORD` (plus a suitable local test facility). Set `CARE_LOCAL_PLUGIN=1` for the in-tree dev host; otherwise provide a built plugin preview through `CARE_REMOTE_URL`. It does not run against deployed instances.

`tests/group-preview.spec.ts` checks the isolated visualization and ordinary answer mapping without a backend; set `VISION_PREVIEW_URL` to its dev server URL. Unit tests cover nullable/locked fields, blank versus zero, both prism axes, distinct lens notes, row reconciliation, choice validation and datetime answers. Run backend Playwright tests with `NODE_OPTIONS="--import tsx"` for schema JSON imports.

## License

MIT.
