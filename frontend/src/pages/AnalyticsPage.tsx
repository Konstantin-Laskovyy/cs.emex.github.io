import { Fragment, useEffect, useMemo, useState } from "react";
import { ApiError, apiDownload, apiFetch } from "../api/client";
import type { CityDailyCount, CourierGivnCount, OrdersSummary } from "../api/types";
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

function CityStatsTable({
  branchLabel,
  countLabel,
  dateLabel,
  emptyText,
  items,
  locale,
  cityLabel,
  showBranch = false,
}: {
  branchLabel?: string;
  countLabel: string;
  dateLabel: string;
  emptyText: string;
  items: CityDailyCount[];
  locale: string;
  cityLabel: string;
  showBranch?: boolean;
}) {
  const groupedItems = useMemo(() => {
    const groups = new Map<string, { date: string; total: number; items: CityDailyCount[] }>();
    items.forEach((item) => {
      const group = groups.get(item.date) ?? { date: item.date, total: 0, items: [] };
      group.total += item.count;
      group.items.push(item);
      groups.set(item.date, group);
    });
    return Array.from(groups.values());
  }, [items]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => new Set());

  if (items.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  if (showBranch) {
    return (
      <div className="analyticsCityTable analyticsCityTableGrouped">
        <div className="analyticsCityHeader analyticsCityDayHeader">
          <span />
          <span>{dateLabel}</span>
          <span>{branchLabel}</span>
          <span>{countLabel}</span>
        </div>
        {groupedItems.map((group) => {
          const isExpanded = expandedDates.has(group.date);
          return (
            <Fragment key={group.date}>
              <button
                className="analyticsCityDayRow"
                type="button"
                aria-expanded={isExpanded}
                onClick={() => {
                  setExpandedDates((current) => {
                    const next = new Set(current);
                    if (next.has(group.date)) next.delete(group.date);
                    else next.add(group.date);
                    return next;
                  });
                }}
              >
                <span className="analyticsCityToggle">{isExpanded ? "-" : "+"}</span>
                <span>{formatDate(group.date, locale)}</span>
                <strong>{group.items.length.toLocaleString(locale)} филиалов</strong>
                <b>{group.total.toLocaleString(locale)}</b>
              </button>
              {isExpanded &&
                group.items.map((item) => (
                  <div className="analyticsCityDetailRow" key={`${item.date}-${item.city_code}-${item.branch_code}`}>
                    <span />
                    <span />
                    <strong>{item.city_name}</strong>
                    <span>{item.branch_name ?? "Без филиала"}</span>
                    <b>{item.count.toLocaleString(locale)}</b>
                  </div>
                ))}
            </Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className={showBranch ? "analyticsCityTable analyticsCityTableWithBranch" : "analyticsCityTable"}>
      <div className="analyticsCityHeader">
        <span>{dateLabel}</span>
        <span>{cityLabel}</span>
        {showBranch && <span>{branchLabel}</span>}
        <span>{countLabel}</span>
      </div>
      {items.map((item) => (
        <div className="analyticsCityRow" key={`${item.date}-${item.city_code}`}>
          <span>{formatDate(item.date, locale)}</span>
          <strong>{item.city_name}</strong>
          {showBranch && <span>{item.branch_name ?? "Без филиала"}</span>}
          <b>{item.count.toLocaleString(locale)}</b>
        </div>
      ))}
    </div>
  );
}

function CourierStatsTable({
  emptyText,
  items,
  locale,
}: {
  emptyText: string;
  items: CourierGivnCount[];
  locale: string;
}) {
  if (items.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="analyticsCourierTable">
      <div className="analyticsCourierHeader">
        <span>Курьер</span>
        <span>Выдачи</span>
        <span>Места</span>
      </div>
      {items.map((item) => (
        <div className="analyticsCourierRow" key={item.courier_code}>
          <strong>{item.courier_name}</strong>
          <b>{item.count.toLocaleString(locale)}</b>
          <span>{item.quantity.toLocaleString(locale)}</span>
        </div>
      ))}
    </div>
  );
}
export function AnalyticsPage() {
  const { language, t } = useLanguage();
  const locale = getLocale(language);
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    apiFetch<OrdersSummary>("/analytics/orders/summary", { timeoutMs: 120000 })
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
  const maxGivnDailyCount = useMemo(() => {
    return Math.max(1, ...(summary?.givn.daily.map((item) => item.count) ?? [0]));
  }, [summary]);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await apiDownload("/analytics/orders/export");
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `courier_delivery_dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t("analytics.loadError"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="analyticsPage">
      <div className="card pageHero">
        <div className="cardInner analyticsHeroInner">
          <div>
            <span className="newsBadge">{t("analytics.badge")}</span>
            <h1>{t("analytics.title")}</h1>
            <p className="muted">{t("analytics.subtitle")}</p>
          </div>
          <button className="btn btnPrimary analyticsExportButton" type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? "Экспорт..." : "Экспорт данных"}
          </button>
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
              <div className="analyticsSplit">
                <span>
                  {t("analytics.pickups")}: <b>{summary.today_pickup_count.toLocaleString(locale)}</b>
                </span>
                <span>
                  {t("analytics.waybills")}: <b>{summary.today_waybill_count.toLocaleString(locale)}</b>
                </span>
              </div>
            </div>
            <div className="analyticsMetric">
              <span>{t("analytics.month")}</span>
              <strong>{summary.month_count.toLocaleString(locale)}</strong>
              <small>
                {t("analytics.since")} · {formatDate(summary.month_start, locale)}
              </small>
              <div className="analyticsSplit">
                <span>
                  {t("analytics.pickups")}: <b>{summary.month_pickup_count.toLocaleString(locale)}</b>
                </span>
                <span>
                  {t("analytics.waybills")}: <b>{summary.month_waybill_count.toLocaleString(locale)}</b>
                </span>
              </div>
            </div>
          </div>

          <div className="analyticsSectionTitle analyticsBlockTitle">
            <h2>Выдача курьерам</h2>
            <span>courier.givn</span>
          </div>

          <div className="analyticsMetricGrid">
            <div className="analyticsMetric analyticsMetricWarm">
              <span>Выдано сегодня</span>
              <strong>{summary.givn.today_count.toLocaleString(locale)}</strong>
              <small>
                {formatDate(summary.today, locale)} В· актов выдачи
              </small>
              <div className="analyticsSplit">
                <span>
                  Мест: <b>{summary.givn.today_quantity.toLocaleString(locale)}</b>
                </span>
              </div>
            </div>
            <div className="analyticsMetric analyticsMetricWarm">
              <span>Выдано за месяц</span>
              <strong>{summary.givn.month_count.toLocaleString(locale)}</strong>
              <small>
                {t("analytics.since")} В· {formatDate(summary.month_start, locale)}
              </small>
              <div className="analyticsSplit">
                <span>
                  Мест: <b>{summary.givn.month_quantity.toLocaleString(locale)}</b>
                </span>
              </div>
            </div>
          </div>

          <div className="analyticsCityGrid">
            <div className="card analyticsTrendCard">
              <div className="cardInner">
                <div className="analyticsSectionTitle">
                  <h2>Динамика выдачи</h2>
                  <span>акты / места</span>
                </div>

                {summary.givn.daily.length === 0 ? (
                  <p className="muted">{t("analytics.empty")}</p>
                ) : (
                  <div className="analyticsBars">
                    {summary.givn.daily.map((item) => (
                      <div className="analyticsBarRow" key={item.date}>
                        <span>{formatDate(item.date, locale)}</span>
                        <div className="analyticsBarTrack analyticsBarTrackWarm">
                          <div
                            className="analyticsBarFill analyticsBarFillWarm"
                            style={{ width: `${Math.max(4, (item.count / maxGivnDailyCount) * 100)}%` }}
                          />
                        </div>
                        <strong>
                          {item.count.toLocaleString(locale)}
                          <small>{item.quantity.toLocaleString(locale)} мест</small>
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card analyticsTrendCard">
              <div className="cardInner">
                <div className="analyticsSectionTitle">
                  <h2>Топ курьеров</h2>
                  <span>за месяц</span>
                </div>
                <CourierStatsTable emptyText={t("analytics.empty")} items={summary.givn.top_couriers} locale={locale} />
              </div>
            </div>
          </div>

          <div className="analyticsSectionTitle analyticsBlockTitle">
            <h2>{t("analytics.title")}</h2>
            <span>courier.address</span>
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
                      <strong>
                        {item.count.toLocaleString(locale)}
                        <small>
                          {item.pickup_count.toLocaleString(locale)} / {item.waybill_count.toLocaleString(locale)}
                        </small>
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="analyticsCityGrid">
            <div className="card analyticsTrendCard">
              <div className="cardInner">
                <div className="analyticsSectionTitle">
                  <h2>{t("analytics.deliveryByCity")}</h2>
                  <span>{t("analytics.waybills")}</span>
                </div>
                <CityStatsTable
                  branchLabel="Филиал"
                  cityLabel={t("analytics.city")}
                  countLabel={t("analytics.count")}
                  dateLabel={t("analytics.date")}
                  emptyText={t("analytics.empty")}
                  items={summary.delivery_by_city}
                  locale={locale}
                  showBranch
                />
              </div>
            </div>

            <div className="card analyticsTrendCard">
              <div className="cardInner">
                <div className="analyticsSectionTitle">
                  <h2>{t("analytics.acceptedByCity")}</h2>
                  <span>Принято складом</span>
                </div>
                <CityStatsTable
                  branchLabel="Филиал"
                  cityLabel={t("analytics.city")}
                  countLabel={t("analytics.count")}
                  dateLabel={t("analytics.date")}
                  emptyText={t("analytics.empty")}
                  items={summary.accepted_by_city}
                  locale={locale}
                  showBranch
                />
              </div>
            </div>

            {false && (
            <div className="card analyticsTrendCard">
              <div className="cardInner">
                <div className="analyticsSectionTitle">
                  <h2>Выдано на доставку по филиалам</h2>
                  <span>{t("analytics.waybills")}</span>
                </div>
                <CityStatsTable
                  cityLabel="Филиал"
                  countLabel={t("analytics.count")}
                  dateLabel={t("analytics.date")}
                  emptyText={t("analytics.empty")}
                  items={[]}
                  locale={locale}
                />
              </div>
            </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
