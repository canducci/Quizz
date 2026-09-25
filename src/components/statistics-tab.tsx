import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { correctRate as rate, needsReview } from "@/domain/statistics";
import { RANGES, type Range, assessmentStatistics } from "@/server/statistics";

type Stats = Awaited<ReturnType<typeof assessmentStatistics>>;
type Format = Awaited<ReturnType<typeof getFormatter>>;
type T = Awaited<ReturnType<typeof getTranslations<"statistics">>>;

const binLabel = (i: number) => `${i * 10}–${i === 9 ? 100 : i * 10 + 9}%`;

/** The Statistics tab (Variant A): filters, number tiles, then three charts, each with a table. */
export async function StatisticsTab({ stats, range }: { stats: Stats; range: Range }) {
  const t = await getTranslations("statistics");
  const format = await getFormatter();
  const day = (d: string) =>
    format.dateTime(new Date(d), { month: "short", day: "numeric", timeZone: "UTC" });
  const href = (r: Range, v: number | null) =>
    `?tab=statistics&range=${r}${v === null ? "" : `&version=${v}`}`;
  const toReview = stats.questions.filter(needsReview).length;
  const empty = ![
    stats.attempts,
    stats.submitted,
    stats.timedOut,
    stats.certificatesIssued,
    stats.revoked,
    stats.expired,
  ].some(Boolean);

  return (
    <div className="stats">
      <div className="filters">
        <nav className="seg" aria-label={t("range")}>
          {RANGES.map((r) => (
            <Link
              key={r}
              href={href(r, stats.version)}
              aria-current={r === range ? "true" : undefined}
            >
              {t(`ranges.${r}`)}
            </Link>
          ))}
        </nav>
        <nav className="seg" aria-label={t("versions")}>
          <Link href={href(range, null)} aria-current={stats.version === null ? "true" : undefined}>
            {t("allVersions")}
          </Link>
          {stats.versions.map((v) => (
            <Link
              key={v.number}
              href={href(range, v.number)}
              aria-current={stats.version === v.number ? "true" : undefined}
            >
              {t("version", { n: v.number, score: v.passingScore })}
            </Link>
          ))}
        </nav>
        <span className="muted note">{t("note")}</span>
      </div>

      {empty ? (
        <div className="card">
          <h3>{t("empty")}</h3>
          <p className="muted">{t("emptyHint", { version: String(stats.version ?? "all") })}</p>
        </div>
      ) : (
        <>
          <div className="tiles">
            <Tile label={t("attempts")} value={format.number(stats.attempts)}>
              {t("timedOut", { n: stats.timedOut })}
            </Tile>
            <Tile
              label={t("passRate")}
              value={
                stats.passRate === null ? "–" : format.number(stats.passRate, { style: "percent" })
              }
            >
              {t("passed", { n: stats.passed })}
            </Tile>
            <Tile
              label={t("medianTime")}
              value={stats.medianMinutes === null ? "–" : t("minutes", { n: stats.medianMinutes })}
            >
              {stats.timeLimit !== null && t("ofLimit", { n: stats.timeLimit })}
            </Tile>
            <Tile label={t("certificates")} value={format.number(stats.certificatesIssued)}>
              {t("certificatesSub", { revoked: stats.revoked, expired: stats.expired })}
            </Tile>
            <Tile label={t("toReview")} value={format.number(toReview)}>
              {toReview ? <span className="flag">{t("below")}</span> : t("allAbove")}
            </Tile>
          </div>
          <div className="charts">
            <div className="card">
              <h3>{t("perDay")}</h3>
              <p className="muted">{t(`ranges.${range}`)}</p>
              <PerDay days={stats.perDay} day={day} t={t} />
              <Table
                t={t}
                head={[t("day"), t("attempts")]}
                rows={stats.perDay.map((d) => [day(d.day), format.number(d.attempts)])}
              />
            </div>
            <div className="card">
              <h3>{t("scores")}</h3>
              <p className="muted">
                {t("scoresSub")} {stats.passingScore === null && t("pickVersion")}
              </p>
              <Scores bins={stats.scoreBins} passing={stats.passingScore} t={t} />
              <Table
                t={t}
                head={[t("score"), t("attempts")]}
                rows={stats.scoreBins.map((n, i) => [binLabel(i), format.number(n)])}
              />
            </div>
            <div className="card wide">
              <h3>{t("questions")}</h3>
              <p className="muted">{t("questionsSub")}</p>
              <Questions questions={stats.questions} format={format} t={t} />
              <Table
                t={t}
                head={[t("question"), t("correct"), t("seen")]}
                rows={stats.questions.map((q) => [
                  `${t("questionLabel", { n: q.n })} ${q.text}`,
                  `${rate(q)}%${needsReview(q) ? " ⚠" : ""}`,
                  format.number(q.shown),
                ])}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile(props: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="card tile">
      <div className="muted">{props.label}</div>
      <div className="value">{props.value}</div>
      <div className="muted">{props.children}</div>
    </div>
  );
}

function Table({ t, head, rows }: { t: T; head: string[]; rows: string[][] }) {
  return (
    <details>
      <summary>{t("table")}</summary>
      <table className="data">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// Plain SVG charts. Tooltips are native <title>s: no script, and screen readers get them too.
const W = 520;

function PerDay(props: {
  days: { day: string; attempts: number }[];
  day: (d: string) => string;
  t: T;
}) {
  const { days, day, t } = props;
  const h = 180;
  const pad = { l: 34, r: 12, t: 10, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const max = Math.max(10, Math.ceil(Math.max(...days.map((d) => d.attempts)) / 5) * 5);
  const x = (i: number) => pad.l + (days.length === 1 ? iw / 2 : (i * iw) / (days.length - 1));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const points = days.map((d, i) => `${x(i)},${y(d.attempts)}`).join(" ");
  const labelled = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];
  return (
    <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={t("perDay")}>
      {[0, max / 2, max].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <polygon
        points={`${x(0)},${y(0)} ${points} ${x(days.length - 1)},${y(0)}`}
        className="wash"
      />
      <polyline points={points} className="line" />
      {labelled.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={h - 6}
          textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}
        >
          {day(days[i].day)}
        </text>
      ))}
      {days.map((d, i) => (
        <rect
          key={d.day}
          x={x(i) - Math.max(4, iw / days.length) / 2}
          y={pad.t}
          width={Math.max(4, iw / days.length)}
          height={ih}
          className="hover"
        >
          <title>{t("dayTip", { day: day(d.day), n: d.attempts })}</title>
        </rect>
      ))}
    </svg>
  );
}

function Scores(props: { bins: number[]; passing: number | null; t: T }) {
  const { bins, passing, t } = props;
  const h = 200;
  const pad = { l: 34, r: 12, t: 16, b: 26 };
  const ih = h - pad.t - pad.b;
  const band = (W - pad.l - pad.r) / 10;
  const bw = Math.min(24, band - 2);
  const max = Math.max(1, ...bins);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={t("scores")}>
      <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} className="axis" />
      {bins.map((n, i) => {
        const top = pad.t + ih - (n / max) * ih;
        return (
          <g key={i}>
            <rect
              x={pad.l + i * band + (band - bw) / 2}
              y={top}
              width={bw}
              height={pad.t + ih - top}
              rx={3}
              className={passing !== null && i * 10 < passing ? "deemph" : "series"}
            >
              <title>{t("scoreTip", { range: binLabel(i), n })}</title>
            </rect>
            <text x={pad.l + i * band + band / 2} y={h - 8} textAnchor="middle">
              {i * 10}
            </text>
          </g>
        );
      })}
      {passing !== null && (
        <g className="passing">
          <line
            x1={pad.l + (passing / 10) * band}
            x2={pad.l + (passing / 10) * band}
            y1={pad.t - 6}
            y2={pad.t + ih}
          />
          <text x={pad.l + (passing / 10) * band + 4} y={pad.t}>
            {t("passingScore", { n: passing })}
          </text>
        </g>
      )}
    </svg>
  );
}

function Questions(props: {
  questions: { n: number; text: string; shown: number; correct: number }[];
  format: Format;
  t: T;
}) {
  const { questions, format, t } = props;
  const w = 1040;
  const rowH = 30;
  const pad = { l: 34, r: 48 };
  const iw = w - pad.l - pad.r;
  const h = questions.length * rowH + 20;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t("questions")}>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line
            x1={pad.l + (v / 100) * iw}
            x2={pad.l + (v / 100) * iw}
            y1={0}
            y2={h - 20}
            className="grid"
          />
          <text x={pad.l + (v / 100) * iw} y={h - 4} textAnchor="middle">
            {v}%
          </text>
        </g>
      ))}
      {questions.map((q, k) => {
        const y = k * rowH + 7;
        const r = rate(q);
        return (
          <g key={q.n}>
            <text x={pad.l - 8} y={y + 12} textAnchor="end">
              {t("questionLabel", { n: q.n })}
            </text>
            <rect
              x={pad.l}
              y={y}
              width={Math.max(1, (r / 100) * iw)}
              height={16}
              rx={3}
              className={needsReview(q) ? "series" : "deemph"}
            >
              <title>
                {t("questionTip", {
                  n: q.n,
                  text: q.text,
                  rate: r,
                  seen: format.number(q.shown),
                })}
              </title>
            </rect>
            <text x={pad.l + (r / 100) * iw + 6} y={y + 12} className="value">
              {r}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
