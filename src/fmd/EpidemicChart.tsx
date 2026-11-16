import { useId } from "react";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  values: ArrayLike<number>;
}

const WIDTH = 760;
const HEIGHT = 340;
const MARGIN = { top: 16, right: 20, bottom: 44, left: 66 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const MAX_POINTS = 1200;

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

/** Indices to draw: every day, or the min and max of each bucket for long horizons. */
function sampleIndices(values: ArrayLike<number>): number[] {
  const n = values.length;
  if (n <= MAX_POINTS) return Array.from({ length: n }, (_, i) => i);
  const bucket = Math.ceil(n / (MAX_POINTS / 2));
  const out: number[] = [];
  for (let start = 0; start < n; start += bucket) {
    const end = Math.min(n, start + bucket);
    let lo = start,
      hi = start;
    for (let i = start; i < end; i++) {
      if (values[i] < values[lo]) lo = i;
      if (values[i] > values[hi]) hi = i;
    }
    out.push(...(lo <= hi ? [lo, hi] : [hi, lo]));
  }
  if (out[out.length - 1] !== n - 1) out.push(n - 1);
  return [...new Set(out)];
}

export default function EpidemicChart({
  series,
  days,
  logScale,
  cursor,
  title,
  description,
}: {
  series: readonly ChartSeries[];
  days: number;
  logScale: boolean;
  cursor: number;
  title: string;
  description: string;
}) {
  const id = useId();
  let max = 0;
  for (const s of series)
    for (let i = 0; i < s.values.length; i++)
      if (s.values[i] > max) max = s.values[i];

  const x = (day: number) =>
    MARGIN.left + (days <= 1 ? 0 : (day / (days - 1)) * PLOT_W);

  let y: (value: number) => number;
  let yTicks: number[];
  if (logScale) {
    const top = Math.max(1, Math.ceil(Math.log10(Math.max(max, 10))));
    y = (value) =>
      MARGIN.top + PLOT_H - (Math.log10(Math.max(value, 1)) / top) * PLOT_H;
    yTicks = Array.from({ length: top + 1 }, (_, k) => 10 ** k);
  } else {
    const step = niceStep(Math.max(max, 1) / 4);
    const top = Math.max(step, Math.ceil(Math.max(max, 1) / step) * step);
    y = (value) => MARGIN.top + PLOT_H - (value / top) * PLOT_H;
    yTicks = [];
    for (let v = 0; v <= top + step / 2; v += step) yTicks.push(v);
  }

  const xStep = niceStep(Math.max(days - 1, 1) / 6);
  const xTicks: number[] = [];
  for (let d = 0; d <= days - 1; d += xStep) xTicks.push(d);
  const cursorDay = Math.min(Math.max(0, cursor), Math.max(0, days - 1));

  return (
    <svg
      className="fmd-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      {yTicks.map((tick) => (
        <g key={`y${tick}`}>
          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="#ebe8f0"
          />
          <text
            x={MARGIN.left - 8}
            y={y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fmd-axis-label"
          >
            {compact.format(tick)}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <text
          key={`x${tick}`}
          x={x(tick)}
          y={HEIGHT - MARGIN.bottom + 18}
          textAnchor="middle"
          className="fmd-axis-label"
        >
          {tick}
        </text>
      ))}
      <line
        x1={MARGIN.left}
        x2={WIDTH - MARGIN.right}
        y1={MARGIN.top + PLOT_H}
        y2={MARGIN.top + PLOT_H}
        stroke="#a9a3b4"
      />
      <text
        x={MARGIN.left + PLOT_W / 2}
        y={HEIGHT - 6}
        textAnchor="middle"
        className="fmd-axis-title"
      >
        Day
      </text>
      <text
        x={14}
        y={MARGIN.top + PLOT_H / 2}
        textAnchor="middle"
        transform={`rotate(-90 14 ${MARGIN.top + PLOT_H / 2})`}
        className="fmd-axis-title"
      >
        {logScale ? "Animals (log scale)" : "Animals"}
      </text>
      {series.map((s) => (
        <polyline
          key={s.key}
          fill="none"
          stroke={s.color}
          strokeWidth={s.dashed ? 2.4 : 2}
          strokeDasharray={s.dashed ? "7 5" : undefined}
          strokeLinejoin="round"
          points={sampleIndices(s.values)
            .map((i) => `${x(i).toFixed(2)},${y(s.values[i]).toFixed(2)}`)
            .join(" ")}
        />
      ))}
      <line
        x1={x(cursorDay)}
        x2={x(cursorDay)}
        y1={MARGIN.top}
        y2={MARGIN.top + PLOT_H}
        stroke="#59398b"
        strokeDasharray="3 3"
      />
      <text
        x={x(cursorDay)}
        y={MARGIN.top - 4}
        textAnchor={cursorDay > (days - 1) * 0.85 ? "end" : "start"}
        className="fmd-cursor-label"
      >
        {`Day ${cursorDay}`}
      </text>
    </svg>
  );
}
