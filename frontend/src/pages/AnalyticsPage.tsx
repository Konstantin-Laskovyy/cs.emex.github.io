import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../api/client";
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
  countLabel,
  dateLabel,
  emptyText,
  items,
  locale,
  cityLabel,
}: {
  countLabel: string;
  dateLabel: string;
  emptyText: string;
  items: CityDailyCount[];
  locale: string;
  cityLabel: string;
}) {
  if (items.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="analyticsCityTable">
      <div className="analyticsCityHeader">
        <span>{dateLabel}</span>
        <span>{cityLabel}</span>
        <span>{countLabel}</span>
      </div>
      {items.map((item) => (
        <div className="analyticsCityRow" key={`${item.date}-${item.city_code}`}>
          <span>{formatDate(item.date, locale)}</span>
          <strong>{item.city_name}</strong>
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
  const maxGivnDailyCount = useMemo(() => {
    return Math.max(1, ...(summary?.givn.daily.map((item) => item.count) ?? [0]));
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
                  cityLabel={t("analytics.city")}
                  countLabel={t("analytics.count")}
                  dateLabel={t("analytics.date")}
                  emptyText={t("analytics.empty")}
                  items={summary.delivery_by_city}
                  locale={locale}
                />
              </div>
            </div>

            <div className="card analyticsTrendCard">
              <div className="cardInner">
                <div className="analyticsSectionTitle">
                  <h2>{t("analytics.acceptedByCity")}</h2>
                  <span>{t("analytics.pickups")}</span>
                </div>
                <CityStatsTable
                  cityLabel={t("analytics.city")}
                  countLabel={t("analytics.count")}
                  dateLabel={t("analytics.date")}
                  emptyText={t("analytics.empty")}
                  items={summary.accepted_by_city}
                  locale={locale}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
