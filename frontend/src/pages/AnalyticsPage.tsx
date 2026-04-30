import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../api/client";
import type { OrdersSummary } from "../api/types";
import { useLanguage } from "../i18n";

function getLocale(language: string) {
  if (language === "kk") return "kk-KZ";
  if (language === "en") return "en-US";
  return "ru-RU";
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function AnalyticsPage() {
  const { language, t } = useLanguage();
  const locale = getLocale(language);
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    apiFetch<OrdersSummary>("/analytics/orders/summary")
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiError ? error.message : t("analytics.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const maxDailyCount = useMemo(() => {
    return Math.max(1, ...(summary?.daily.map((item) => item.count) ?? [0]));
  }, [summary]);

  return (
    <section className="analyticsPage">
      <div className="card pageHero">
        <div className="cardInner">
          <span className="newsBadge">{t("analytics.badge")}</span>
          <h1>{t("analytics.title")}</h1>
          <p className="muted">{t("analytics.subtitle")}</p>
        </div>
      </div>

      {loading && (
        <div className="card">
          <div className="cardInner muted">{t("analytics.loading")}</div>
        </div>
      )}

      {!loading && loadError && (
        <div className="card analyticsErrorCard">
          <div className="cardInner">{loadError}</div>
        </div>
      )}

      {!loading && !loadError && summary && (
        <>
          <div className="analyticsMetricGrid">
            <div className="analyticsMetric">
              <span>{t("analytics.today")}</span>
              <strong>{summary.today_count.toLocaleString(locale)}</strong>
              <small>
                {formatDate(summary.today, locale)} · {t("analytics.orders")}
              </small>
            </div>
            <div className="analyticsMetric">
              <span>{t("analytics.month")}</span>
              <strong>{summary.month_count.toLocaleString(locale)}</strong>
              <small>
                {t("analytics.since")} · {formatDate(summary.month_start, locale)}
              </small>
            </div>
          </div>

          <div className="card analyticsTrendCard">
            <div className="cardInner">
              <div className="analyticsSectionTitle">
                <h2>{t("analytics.daily")}</h2>
                <span>{t("analytics.orders")}</span>
              </div>

              {summary.daily.length === 0 ? (
                <p className="muted">{t("analytics.empty")}</p>
              ) : (
                <div className="analyticsBars">
                  {summary.daily.map((item) => (
                    <div className="analyticsBarRow" key={item.date}>
                      <span>{formatDate(item.date, locale)}</span>
                      <div className="analyticsBarTrack">
                        <div
                          className="analyticsBarFill"
                          style={{ width: `${Math.max(4, (item.count / maxDailyCount) * 100)}%` }}
                        />
                      </div>
                      <strong>{item.count.toLocaleString(locale)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
