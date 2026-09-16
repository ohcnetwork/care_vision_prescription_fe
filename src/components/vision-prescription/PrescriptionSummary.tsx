import { useTranslation } from "../../hooks/useTranslation";
import { DURATION_LABELS, EYES, PRODUCTS } from "../../lib/constants";
import {
  type LensSpecification,
  type PrismPlane,
  type VisionPrescription,
  formatDate,
  formatNumeric,
  getLens,
  getPrism,
  getProduct,
} from "../../lib/prescription";
import { getPrescriptionIssues } from "../../lib/validate";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface PrescriptionSummaryProps {
  prescription: VisionPrescription;
  note?: string;
}

export function PrescriptionSummary({
  prescription,
  note,
}: PrescriptionSummaryProps) {
  const { t, i18n } = useTranslation();
  const prescriber = prescription.context?.prescriber;
  const invalid = getPrescriptionIssues(prescription).length > 0;
  const warning = invalid
    ? "invalid_record"
    : prescription.status === "draft"
      ? "draft_warning"
      : prescription.status !== "active"
        ? "not_active_warning"
        : undefined;
  const prismText = (
    lens: LensSpecification | undefined,
    plane: PrismPlane,
  ) => {
    const prism = lens && getPrism(lens, plane);
    if (!prism) return "-";
    return `${formatNumeric(prism.amount)} ${prism.base ? t(prism.base) : t("not_recorded")}`;
  };

  return (
    <div
      className="vision-summary space-y-4"
      data-prescription-status={prescription.status}
    >
      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 print:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">{t("dateWritten")}</dt>
          <dd className="mt-1 font-medium">
            {formatDate(prescription.dateWritten, i18n.resolvedLanguage)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("status")}</dt>
          <dd className="mt-1 font-medium">{t(prescription.status)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("prescriber")}</dt>
          <dd className="mt-1 font-medium">
            {prescriber?.display ?? t("prescriber_unknown")}
          </dd>
        </div>
      </dl>
      {warning && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm font-medium text-destructive"
        >
          {t(warning)}
        </p>
      )}
      {PRODUCTS.filter((product) =>
        prescription.lensSpecification.some(
          (lens) => getProduct(lens) === product,
        ),
      ).map((product) => (
        <section key={product} className="space-y-2">
          <h4 className="text-sm font-semibold">{t(product)}</h4>
          <Table aria-label={t(product)} className="vision-summary-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("eye")}</TableHead>
                <TableHead className="text-right">
                  {t(product === "lens" ? "sphere_unit" : "power_unit")}
                </TableHead>
                <TableHead className="text-right">
                  {t("cylinder_unit")}
                </TableHead>
                <TableHead className="text-right">{t("axis_unit")}</TableHead>
                <TableHead className="text-right">{t("add_unit")}</TableHead>
                <TableHead className="text-right">
                  {t("prism_horizontal")}
                </TableHead>
                <TableHead className="text-right">
                  {t("prism_vertical")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EYES.map((eye) => {
                const lens = getLens(prescription, product, eye);
                return (
                  <TableRow key={eye}>
                    <TableHead scope="row" className="text-foreground">
                      {t(eye)}{" "}
                      <span className="font-mono font-normal text-muted-foreground">
                        ({t(`${eye}_short`)})
                      </span>
                    </TableHead>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatNumeric(
                        lens?.[product === "lens" ? "sphere" : "power"],
                        true,
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatNumeric(lens?.cylinder, true)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatNumeric(lens?.axis)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatNumeric(lens?.add, true)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {prismText(lens, "horizontal")}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {prismText(lens, "vertical")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {product === "contact" && (
            <Table
              aria-label={t("contact_details")}
              className="vision-summary-table"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>{t("eye")}</TableHead>
                  <TableHead className="text-right">
                    {t("back_curve_unit")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("diameter_unit")}
                  </TableHead>
                  <TableHead className="text-right">{t("duration")}</TableHead>
                  <TableHead>{t("color")}</TableHead>
                  <TableHead>{t("brand")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EYES.map((eye) => {
                  const lens = getLens(prescription, "contact", eye);
                  const duration = lens?.duration;
                  return (
                    <TableRow key={eye}>
                      <TableHead scope="row" className="text-foreground">
                        {t(eye)}
                      </TableHead>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatNumeric(lens?.backCurve)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatNumeric(lens?.diameter)}
                      </TableCell>
                      <TableCell className="text-right">
                        {duration
                          ? `${formatNumeric(duration.value)} ${duration.code ? t(DURATION_LABELS[duration.code]) : t("not_recorded")}`
                          : "-"}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap">
                        {lens?.color || "-"}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap">
                        {lens?.brand || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      ))}
      {note && (
        <section className="space-y-1 text-sm">
          <h4 className="font-medium">{t("note")}</h4>
          <p className="break-words whitespace-pre-wrap">{note}</p>
        </section>
      )}
    </div>
  );
}
