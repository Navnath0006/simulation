import { useEffect, useId, useRef, useState } from "react";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** SVG stroke-dasharray; omitted for a solid line. */
  dash?: string;
  linecap?: "butt" | "round";
  width?: number;
  values: ArrayLike<number>;
}

const DEFAULT_WIDTH = 760;
const NARROW = 560;

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
function sampleIndices(values: ArrayLike<number>, maxPoints: number): number[] {
  const n = values.length;
  if (n <= maxPoints) return Array.from({ length: n }, (_, i) => i);
  const bucket = Math.ceil(n / (maxPoints / 2));
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

/**
 * Line chart drawn in SVG user units equal to CSS pixels (the viewBox follows the
 * container width), so axis text stays legible on phones. No inline styles (strict CSP).
 */
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
  const wrapper = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const element = wrapper.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const width = Math.round(element.getBoundingClientRect().width);
      if (width > 0) setMeasured(width);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const width = Math.max(280, measured);
  const narrow = width < NARROW;
  const height = narrow ? Math.round(width * 0.78) : 340;
  const margin = narrow
    ? { top: 18, right: 12, bottom: 40, left: 50 }
    : { top: 16, right: 20, bottom: 44, left: 66 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const maxPoints = Math.min(1200, plotW * 2);

  let max = 0;
  for (const s of series)
    for (let i = 0; i < s.values.length; i++)
      if (s.values[i] > max) max = s.values[i];

  const x = (day: number) =>
    margin.left + (days <= 1 ? 0 : (day / (days - 1)) * plotW);

  let y: (value: number) => number;
  let yTicks: number[];
  if (logScale) {
    const top = Math.max(1, Math.ceil(Math.log10(Math.max(max, 10))));
    y = (value) =>
      margin.top + plotH - (Math.log10(Math.max(value, 1)) / top) * plotH;
    const every = narrow && top > 6 ? 2 : 1;
    yTicks = [];
    for (let k = 0; k <= top; k += every) yTicks.push(10 ** k);
  } else {
    const step = niceStep(Math.max(max, 1) / (narrow ? 3 : 4));
    const top = Math.max(step, Math.ceil(Math.max(max, 1) / step) * step);
    y = (value) => margin.top + plotH - (value / top) * plotH;
    yTicks = [];
    for (let v = 0; v <= top + step / 2; v += step) yTicks.push(v);
  }

  const xStep = niceStep(Math.max(days - 1, 1) / (narrow ? 4 : 6));
  const xTicks: number[] = [];
  for (let d = 0; d <= days - 1; d += xStep) xTicks.push(d);
  const cursorDay = Math.min(Math.max(0, cursor), Math.max(0, days - 1));

  return (
    <div ref={wrapper} className="fmd-chart-wrap">
      <svg
        className="fmd-chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
      >
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{description}</desc>
        {yTicks.map((tick) => (
          <g key={`y${tick}`}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#ebe8f0"
            />
            <text
              x={margin.left - 8}
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
            y={height - margin.bottom + 18}
            textAnchor="middle"
            className="fmd-axis-label"
          >
            {tick}
          </text>
        ))}
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={margin.top + plotH}
          y2={margin.top + plotH}
          stroke="#a9a3b4"
        />
        <text
          x={margin.left + plotW / 2}
          y={height - 6}
          textAnchor="middle"
          className="fmd-axis-title"
        >
          Day
        </text>
        <text
          x={14}
          y={margin.top + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${margin.top + plotH / 2})`}
          className="fmd-axis-title"
        >
          {logScale ? "Animals (log scale)" : "Animals"}
        </text>
        {series.map((s) => (
          <polyline
            key={s.key}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width ?? 2}
            strokeDasharray={s.dash}
            strokeLinecap={s.linecap ?? "butt"}
            strokeLinejoin="round"
            points={sampleIndices(s.values, maxPoints)
              .map((i) => `${x(i).toFixed(2)},${y(s.values[i]).toFixed(2)}`)
              .join(" ")}
          />
        ))}
        <line
          x1={x(cursorDay)}
          x2={x(cursorDay)}
          y1={margin.top}
          y2={margin.top + plotH}
          stroke="#59398b"
          strokeDasharray="3 3"
        />
        <text
          x={x(cursorDay)}
          y={margin.top - 4}
          textAnchor={cursorDay > (days - 1) * 0.85 ? "end" : "start"}
          className="fmd-cursor-label"
        >
          {`Day ${cursorDay}`}
        </text>
      </svg>
    </div>
  );
}
