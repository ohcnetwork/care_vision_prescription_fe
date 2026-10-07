# Vision prescription schema

This document describes the ordinary questionnaire answers saved by the Vision plugin. The executable definitions are `PRESCRIPTION_DETAILS_SCHEMA` and `VISION_SCHEMA` in [src/lib/group.ts](src/lib/group.ts); registration is in [src/manifest.tsx](src/manifest.tsx).

## Groups

Both groups use question type `group` and support `encounter` questionnaires.

| Group identifier (`structured_type`)               | Repeating | Data                                           |
| -------------------------------------------------- | --------- | ---------------------------------------------- |
| `care_vision_prescription_fe.prescription_details` | No        | Prescription status and authorization datetime |
| `care_vision_prescription_fe.vision_prescription`  | Yes       | One lens specification per product/eye pair    |

These are independently authored groups. Adding lens specifications does not automatically add prescription details. There is no saved reference connecting the two groups; their questionnaire placement supplies the context.

CARE creates the question IDs and scopes each local key as `<group.link_id>__<key>`. For example, `vision__sphere` identifies the sphere child in a group with `link_id = "vision"`. Repeating rows share the saved child question IDs and are distinguished by their position in `sub_results`.

## Prescription details fields

| Local key     | Question type | Required | Saved value                                        |
| ------------- | ------------- | -------- | -------------------------------------------------- |
| `status`      | `choice`      | Yes      | `draft`, `active`, `cancelled`, `entered-in-error` |
| `dateWritten` | `dateTime`    | Yes      | Authorization datetime                             |

The datetime input uses browser-local time. Frontend state holds a JavaScript `Date`; submission serializes its UTC ISO timestamp. The callback rejects invalid dates and dates after today in the browser's local calendar. It compares calendar days, not whether the time is later today.

The group is non-repeating, so its child results are submitted at the enclosing response level. There is no parent result wrapping status and date.

## Lens specification fields

Each row contains these 18 single-answer child questions. `product` and `eye` are required by the schema. The callback also requires the product's primary optical value when that field exists in the saved schema: `sphere` for `lens`, or `power` for `contact`.

| Local key                 | Question type | Meaning and values                                   |
| ------------------------- | ------------- | ---------------------------------------------------- |
| `note`                    | `text`        | One free-text note for this product/eye              |
| `product`                 | `choice`      | `lens` (spectacles) or `contact`                     |
| `eye`                     | `choice`      | `right` or `left`                                    |
| `sphere`                  | `decimal`     | Spectacle sphere, dioptres                           |
| `power`                   | `decimal`     | Contact lens power, dioptres                         |
| `cylinder`                | `decimal`     | Cylinder, dioptres                                   |
| `axis`                    | `integer`     | Cylinder axis, degrees; 0 through 180 inclusive      |
| `add`                     | `decimal`     | Addition, dioptres                                   |
| `backCurve`               | `decimal`     | Contact lens back curve, millimetres                 |
| `diameter`                | `decimal`     | Contact lens diameter, millimetres                   |
| `prism_horizontal_amount` | `decimal`     | Horizontal prism amount, prism dioptres              |
| `prism_horizontal_base`   | `choice`      | `in` or `out`                                        |
| `prism_vertical_amount`   | `decimal`     | Vertical prism amount, prism dioptres                |
| `prism_vertical_base`     | `choice`      | `up` or `down`                                       |
| `duration`                | `decimal`     | Contact lens wear duration                           |
| `durationCode`            | `choice`      | `h` (hours), `d` (days), `wk` (weeks), `mo` (months) |
| `color`                   | `string`      | Contact lens color                                   |
| `brand`                   | `string`      | Contact lens brand                                   |

Units in this table describe field semantics. The numeric children are ordinary decimal/integer answers, not quantity answers with saved unit/coding objects. `durationCode` is a separate choice answer. The text child `note` is also distinct from CARE's optional response-level `note` metadata.

## Rows and empty answers

- One row represents one `(product, eye)` pair. With the current choices, there are at most four distinct pairs.
- Editing a table cell creates or updates that pair's row. Clearing its last value other than product/eye removes the row. A note counts as a value, so a note-only row still needs the primary optical value before submission.
- Zero is an answered value. It is preserved, including a sphere/power of zero and a prism amount of zero.
- A cleared field has `values: []`; submission omits that child. An empty optional lens group has no rows and is omitted from results. If the parent is required, core requires at least one row.
- Partial numbers such as `"-"` and incomplete prism pairs may remain in a draft. They fail submission validation.
- Both prism planes fit in the same row. There is one amount/base pair per plane and one note per row; there are no nested repeating prism or note groups.

## Submitted answer example

This example shows the `results` array contents for prescription details and two lens rows. IDs are illustrative placeholders for saved question IDs. Unanswered children are omitted.

```json
[
  {
    "question_id": "status-id",
    "values": [{ "value": "active" }]
  },
  {
    "question_id": "date-written-id",
    "values": [{ "type": "dateTime", "value": "2020-01-01T10:00:00.000Z" }]
  },
  {
    "question_id": "lens-group-id",
    "sub_results": [
      [
        { "question_id": "product-id", "values": [{ "value": "lens" }] },
        { "question_id": "eye-id", "values": [{ "value": "right" }] },
        { "question_id": "sphere-id", "values": [{ "value": "0" }] },
        { "question_id": "cylinder-id", "values": [{ "value": "-0.75" }] },
        { "question_id": "axis-id", "values": [{ "value": "90" }] },
        {
          "question_id": "prism-horizontal-amount-id",
          "values": [{ "value": "1.5" }]
        },
        {
          "question_id": "prism-horizontal-base-id",
          "values": [{ "value": "out" }]
        },
        {
          "question_id": "note-id",
          "values": [{ "value": "Coating requested" }]
        }
      ],
      [
        { "question_id": "product-id", "values": [{ "value": "contact" }] },
        { "question_id": "eye-id", "values": [{ "value": "left" }] },
        { "question_id": "power-id", "values": [{ "value": "-2.25" }] },
        { "question_id": "back-curve-id", "values": [{ "value": "8.6" }] },
        { "question_id": "diameter-id", "values": [{ "value": "14.2" }] },
        { "question_id": "duration-id", "values": [{ "value": "8" }] },
        { "question_id": "duration-code-id", "values": [{ "value": "h" }] }
      ]
    ]
  }
]
```

Frontend numeric entries use numbers, for example `{ type: "number", value: 0 }`. The ordinary submit serializer converts these values to strings, as shown above. Choice/text entries also serialize as strings. The current datetime serializer retains the `dateTime` discriminator.

## Submission validation

The manifest exposes `validatePrescriptionDetails` and `validateLensGroup` from [src/lib/groupValidation.ts](src/lib/groupValidation.ts). Core calls the relevant function during its existing group traversal; the plugin returns ordinary errors with saved question IDs and complete response paths.

The details callback checks single-value cardinality, known statuses, valid datetimes, and the calendar-day rule above. Core checks missing required answers.

The lens callback parses the saved rows and reuses `getLensIssues` from [src/lib/validate.ts](src/lib/validate.ts):

- Product/eye identities must be recognized and unique; child answers must be single-valued.
- Spectacles need `sphere`; contacts need `power`. Numeric optical values must be finite numbers.
- `sphere`, `power`, `cylinder`, and `add` must use 0.25-dioptre increments.
- Cylinder and axis require each other, including when cylinder is zero. Axis must be an integer from 0 through 180.
- `backCurve` and `diameter`, when supplied, must be positive.
- Each supplied prism needs an amount and base; its amount must be finite and nonnegative.
- Wear duration needs a finite positive value and a recognized duration code.
- Spectacle rows reject `power`, `backCurve`, `diameter`, duration, color, and brand. Contact rows reject `sphere`.

Field errors target the corresponding saved child and row. Malformed rows produce a group error. Older schemas do not receive field errors targeting absent optional children. These are frontend submission checks; the callback does not submit a separate prescription resource.

## Derived data and compatibility

The UI builds a prescription-shaped view for display and optical calculations. Product coding objects, duration unit/system objects, prism arrays, and note annotations in that view are derived from these scalar answers. They are not an additional saved JSON payload. The groups do not save a `schemaVersion`, `created`, patient reference, prescriber reference, or context object. CARE owns encounter association and response authorship.

Keep group identifiers, child keys, and choice values stable. New questionnaires use the current TypeScript definitions; existing questionnaires retain their saved children. Core's explicit schema repair updates the authored questionnaire, not historical clinical answers. Vision currently makes the lens UI read-only when expected children are missing, hidden, or protected.

Earlier non-repeating lens schemas require explicit repair for future collection; add the separate prescription details group as needed. Historical non-repeating answers use ordinary child rendering. Older `type: "structured"` prescription JSON is not automatically migrated to these groups.

Keep this document aligned with schema, mapping, and validator changes.
