import { useInfiniteQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "../../hooks/useTranslation";
import { CareApiError, careApiUrl } from "../../lib/careApi";
import { PLUGIN_SLUG } from "../../lib/constants";
import {
  extractPrescriptions,
  fetchHistoryPage,
  nextHistoryOffset,
} from "../../lib/history";
import { formatDate } from "../../lib/prescription";
import { Button } from "../ui/button";
import { PrescriptionSummary } from "./PrescriptionSummary";

export function PrescriptionHistory({
  patientId,
  userId,
}: {
  patientId: string;
  userId: string;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const history = useInfiniteQuery({
    queryKey: [PLUGIN_SLUG, "history", careApiUrl(), patientId, userId],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchHistoryPage(patientId, pageParam, signal),
    getNextPageParam: nextHistoryOffset,
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const entries = extractPrescriptions(
    history.data?.pages.flatMap((page) => page.results) ?? [],
    patientId,
  );

  return (
    <section className="vision-history space-y-3 border-t pt-3 print:hidden">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <History className="size-4" aria-hidden="true" />
        {t("history_title")}
      </Button>
      {open && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("compare_description")}
          </p>
          {history.isPending && (
            <p role="status" className="text-sm">
              {t("history_pending")}
            </p>
          )}
          {history.isError && (
            <div
              role="alert"
              className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm"
            >
              <p>
                {t(
                  history.error instanceof CareApiError &&
                    [401, 403].includes(history.error.status)
                    ? "history_permission"
                    : "history_error",
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void history.refetch()}
              >
                {t("retry")}
              </Button>
            </div>
          )}
          {history.isSuccess && entries.length === 0 && (
            <p className="text-sm">
              {t(history.hasNextPage ? "history_page_empty" : "history_none")}
            </p>
          )}
          {entries.map((entry) => (
            <details key={entry.id} className="rounded-md border bg-card">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
                {entry.answer.kind === "value"
                  ? `${formatDate(entry.answer.prescription.dateWritten, i18n.resolvedLanguage)} - ${t(entry.answer.prescription.status)}`
                  : entry.createdDate.slice(0, 10)}
                <span className="ml-2 font-normal text-muted-foreground">
                  {entry.title}
                </span>
              </summary>
              <div className="border-t p-3">
                {entry.answer.kind === "value" ? (
                  <PrescriptionSummary
                    prescription={entry.answer.prescription}
                    note={entry.note}
                    showSignature={false}
                  />
                ) : (
                  <p role="alert" className="text-sm text-destructive">
                    {t("history_invalid")}
                  </p>
                )}
              </div>
            </details>
          ))}
          {history.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              disabled={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              {t(
                history.isFetchingNextPage
                  ? "history_pending"
                  : "check_earlier",
              )}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
