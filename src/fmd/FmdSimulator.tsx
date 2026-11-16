import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import EpidemicChart, { type ChartSeries } from "./EpidemicChart";
import {
  isAdditiveSeason,
  seasonFactor,
  type Compartment,
  type ContactLevel,
} from "./engine";
import {
  DEFAULT_INPUTS,
  FIELDS,
  GROUP_LABELS,
  LEVEL_LABELS,
  MONTH_NAMES,
  derivedCattle,
  formatCount,
  parametersCsv,
  parseForm,
  resultsCsv,
  runFmdScenario,
  toFormValues,
  type FieldGroup,
  type FieldSpec,
  type FmdInputs,
  type FormValues,
  type NumericField,
} from "./model";

type SeriesKey = Compartment | "I_total";

const SERIES: readonly {
  key: SeriesKey;
  label: string;
  color: string;
  dashed?: boolean;
}[] = [
  {
    key: "I_total",
    label: "All infected animals",
    color: "#1f2937",
    dashed: true,
  },
  { key: "E_C", label: "Exposed cattle", color: "#d97706" },
  { key: "I_C1", label: "Asymptomatic cattle", color: "#7c3aed" },
  { key: "I_C2", label: "Symptomatic cattle", color: "#dc2626" },
  { key: "q_C", label: "Isolated cattle", color: "#be185d" },
  { key: "I_B", label: "Infected buffalo", color: "#a16207" },
  { key: "I_P", label: "Infected pigs", color: "#0891b2" },
  { key: "I_S", label: "Infected sheep/goats", color: "#64748b" },
  { key: "S_C", label: "Susceptible cattle", color: "#2563eb" },
  { key: "R_C", label: "Recovered cattle", color: "#16a34a" },
  { key: "V_C1", label: "Vaccinated cattle (< 3 rounds)", color: "#0d9488" },
  { key: "V_C2", label: "Vaccinated cattle (≥ 3 rounds)", color: "#065f46" },
];
const DEFAULT_VISIBLE: readonly SeriesKey[] = [
  "I_total",
  "E_C",
  "I_C1",
  "I_C2",
  "I_B",
  "I_P",
  "I_S",
];

const HOST_ROWS: readonly { host: string; rows: [Compartment, string][] }[] = [
  {
    host: "Cattle",
    rows: [
      ["S_C", "Susceptible"],
      ["E_C", "Exposed"],
      ["I_C1", "Asymptomatic infected"],
      ["I_C2", "Symptomatic infected"],
      ["R_C", "Recovered"],
      ["V_C1", "Vaccinated, < 3 rounds"],
      ["V_C2", "Vaccinated, ≥ 3 rounds"],
      ["Q_C", "Quarantined"],
      ["q_C", "Isolated"],
    ],
  },
  {
    host: "Buffalo",
    rows: [
      ["S_B", "Susceptible"],
      ["E_B", "Exposed"],
      ["I_B", "Infected"],
      ["V_B1", "Vaccinated (V_B1)"],
      ["V_B2", "Vaccinated (V_B2)"],
      ["R_B", "Recovered"],
    ],
  },
  {
    host: "Pigs",
    rows: [
      ["S_P", "Susceptible"],
      ["I_P", "Infected"],
      ["V_P", "Vaccinated"],
      ["R_P", "Recovered"],
    ],
  },
  {
    host: "Sheep and goats",
    rows: [
      ["S_S", "Susceptible"],
      ["I_S", "Infected"],
      ["V_S", "Vaccinated"],
      ["R_S", "Recovered"],
    ],
  },
];

const GROUP_ORDER: readonly FieldGroup[] = [
  "horizon",
  "populations",
  "cattle",
  "otherHosts",
  "transmission",
  "mortality",
  "vaccination",
  "environment",
  "advanced",
];
const OPEN_BY_DEFAULT: readonly FieldGroup[] = [
  "horizon",
  "populations",
  "cattle",
  "transmission",
  "vaccination",
];

function seasonLabel(level: ContactLevel, month: number): string {
  if (month === 0) return MONTH_NAMES[0];
  const factor = seasonFactor(level, month);
  return `${MONTH_NAMES[month]} (${isAdditiveSeason(level) ? `+${factor.toFixed(3)}` : `${factor.toFixed(2)}×`})`;
}

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function NumberField({
  spec,
  value,
  error,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  error?: string;
  onChange: (key: NumericField, value: string) => void;
}) {
  const id = `fmd-${spec.key}`;
  return (
    <div className={`fmd-field ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>
        {spec.label}
        {spec.unit && <span className="fmd-unit"> ({spec.unit})</span>}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        onChange={(event) => onChange(spec.key, event.target.value)}
      />
      <small id={`${id}-help`}>{spec.help}</small>
      {error && (
        <small id={`${id}-error`} className="fmd-error">
          {error}
        </small>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "plain" | "alert" | "good";
}) {
  return (
    <div className={`fmd-kpi tone-${tone}`}>
      <dt>{label}</dt>
      <dd>
        <span className="fmd-kpi-value">{value}</span>
        <span className="fmd-kpi-note">{note}</span>
      </dd>
    </div>
  );
}

interface FormState {
  level: ContactLevel;
  month: number;
  values: FormValues;
}
const DEFAULT_FORM: FormState = {
  level: DEFAULT_INPUTS.level,
  month: DEFAULT_INPUTS.month,
  values: toFormValues(DEFAULT_INPUTS),
};
/** Longer horizons take noticeable time (≈0.5 s for 3,650 days), so wait for a pause in typing. */
const LONG_RUN_DAYS = 1000;
const LONG_RUN_DELAY_MS = 400;

export default function FmdSimulator() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const { level, month, values } = form;
  const parsed = useMemo(
    () => parseForm(values, level, month),
    [values, level, month],
  );
  // Results always come from the last valid set of inputs.
  const [applied, setApplied] = useState<FmdInputs>(DEFAULT_INPUTS);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const updateForm = (next: FormState) => {
    setForm(next);
    clearTimeout(timer.current);
    const checked = parseForm(next.values, next.level, next.month).inputs;
    if (!checked || checked.days <= LONG_RUN_DAYS) {
      setPending(false);
      if (checked) setApplied(checked);
      return;
    }
    setPending(true);
    timer.current = setTimeout(() => {
      setPending(false);
      setApplied(checked);
    }, LONG_RUN_DELAY_MS);
  };
  const deferred = useDeferredValue(applied);
  const result = useMemo(() => runFmdScenario(deferred), [deferred]);
  const updating = pending || deferred !== applied;

  const [visible, setVisible] = useState<ReadonlySet<SeriesKey>>(
    () => new Set(DEFAULT_VISIBLE),
  );
  const [logScale, setLogScale] = useState(false);
  const [cursor, setCursor] = useState(0);
  const day = Math.min(cursor, result.core.days - 1);

  const [openGroups, setOpenGroups] = useState<ReadonlySet<FieldGroup>>(
    () => new Set(OPEN_BY_DEFAULT),
  );
  const errorGroups = useMemo(
    () =>
      new Set(
        FIELDS.filter((field) => parsed.errors[field.key]).map(
          (field) => field.group,
        ),
      ),
    [parsed.errors],
  );

  const draft = parsed.inputs ?? applied;
  const derived = derivedCattle({ ...draft, level });
  const errorCount = Object.keys(parsed.errors).length;

  const setField = (key: NumericField, value: string) =>
    updateForm({ ...form, values: { ...values, [key]: value } });
  const reset = () => {
    updateForm(DEFAULT_FORM);
    setCursor(0);
  };
  const toggleSeries = (key: SeriesKey) =>
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const chartSeries: ChartSeries[] = SERIES.filter((s) =>
    visible.has(s.key),
  ).map((s) => ({
    ...s,
    values: s.key === "I_total" ? result.infected : result.core.series[s.key],
  }));
  const impact = result.vaccination;
  const flowsAtDay = {
    infections: impact.withVaccination.infections[day],
    deaths: impact.withVaccination.deaths[day],
    vaccinated: impact.withVaccination.vaccinated[day],
    averted:
      impact.noVaccination.infections[day] -
      impact.withVaccination.infections[day],
  };
  const R0 = result.R0;
  const hit = result.herdImmunity;
  const peak = result.peak;
  const env = result.environment;
  const stamp = `${result.inputs.level}-${result.inputs.days}d`;

  return (
    <div className="fmd-simulator">
      <div className="fmd-workspace">
        <aside className="fmd-panel" aria-label="Simulation parameters">
          <div className="fmd-panel-head">
            <h2>Parameters</h2>
            <button type="button" className="button secondary" onClick={reset}>
              Reset to defaults
            </button>
          </div>
          <fieldset className="fmd-group">
            <legend>Scenario</legend>
            <div className="fmd-field">
              <label htmlFor="fmd-level">Level</label>
              <select
                id="fmd-level"
                value={level}
                aria-describedby="fmd-level-help"
                onChange={(event) =>
                  updateForm({
                    ...form,
                    level: event.target.value as ContactLevel,
                  })
                }
              >
                {(Object.keys(LEVEL_LABELS) as ContactLevel[]).map((key) => (
                  <option key={key} value={key}>
                    {LEVEL_LABELS[key]}
                  </option>
                ))}
              </select>
              <small id="fmd-level-help">
                Farm: closed outbreak, seasonality multiplies β. District and
                state: births, waning and quarantine release return animals to
                the susceptible pool and seasonality is added to β. State level
                also makes day-0 compartments add up to each population.
                Parameter values are not replaced when the level changes.
              </small>
            </div>
            <div className="fmd-field">
              <label htmlFor="fmd-month">Seasonality (month)</label>
              <select
                id="fmd-month"
                value={month}
                onChange={(event) =>
                  updateForm({ ...form, month: Number(event.target.value) })
                }
              >
                {MONTH_NAMES.map((_, index) => (
                  <option key={index} value={index}>
                    {seasonLabel(level, index)}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
          {GROUP_ORDER.map((group) => {
            const fields = FIELDS.filter((field) => field.group === group);
            const open = openGroups.has(group) || errorGroups.has(group);
            return (
              <details
                key={group}
                className="fmd-group"
                open={open}
                onToggle={(event) => {
                  const isOpen = event.currentTarget.open;
                  if (isOpen !== openGroups.has(group))
                    setOpenGroups((current) => {
                      const next = new Set(current);
                      if (isOpen) next.add(group);
                      else next.delete(group);
                      return next;
                    });
                }}
              >
                <summary>
                  {GROUP_LABELS[group]}
                  {errorGroups.has(group) && (
                    <span className="fmd-error-badge">Check values</span>
                  )}
                </summary>
                {group === "populations" && (
                  <p className="fmd-derived">
                    Total population N ={" "}
                    <strong>{formatCount(derived.N)}</strong>
                  </p>
                )}
                {group === "cattle" && (
                  <p className="fmd-derived">
                    Susceptible cattle S_C ={" "}
                    <strong>{formatCount(derived.S_C0)}</strong>; recovered R_C
                    = <strong>{formatCount(derived.R_C0)}</strong>
                    {level === "district" ? " (V_C2 + additional)" : ""}.
                  </p>
                )}
                {fields.map((spec) => (
                  <NumberField
                    key={spec.key}
                    spec={spec}
                    value={values[spec.key]}
                    error={parsed.errors[spec.key]}
                    onChange={setField}
                  />
                ))}
              </details>
            );
          })}
        </aside>

        <section className="fmd-results" aria-label="Simulation results">
          <div className="fmd-status" role="status" aria-live="polite">
            {errorCount > 0
              ? `${errorCount} ${errorCount === 1 ? "value needs" : "values need"} correction. Results show the last valid inputs.`
              : updating
                ? "Updating results…"
                : `Results for ${LEVEL_LABELS[result.inputs.level].toLowerCase()}, ${result.inputs.days} days.`}
          </div>
          {result.warnings.length > 0 && (
            <ul className="fmd-warnings">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <dl className="fmd-kpis">
            <Kpi
              label="Basic reproduction number R₀"
              value={R0 > 0 ? R0.toFixed(4) : "0"}
              note={
                R0 > 1
                  ? "Above 1: the outbreak can spread."
                  : "At or below 1: the outbreak is not expected to spread."
              }
              tone={R0 > 1 ? "alert" : "good"}
            />
            <Kpi
              label="Herd immunity threshold"
              value={hit === null ? "Not required" : `${hit.toFixed(0)}%`}
              note={
                hit === null
                  ? "R₀ ≤ 1."
                  : `Vaccinate at least ${hit.toFixed(0)}% of susceptibles (1 − 1/R₀).`
              }
            />
            <Kpi
              label="Peak infected animals, all hosts"
              value={formatCount(peak.peak)}
              note={`On day ${peak.peakDay}.`}
            />
            <Kpi
              label="Cattle infections averted by vaccination"
              value={impact.saved > 0.5 ? formatCount(impact.saved) : "0"}
              note={
                impact.infectionsWithout > 0
                  ? `${impact.percentFewer.toFixed(1)}% fewer infections • ${((impact.saved / impact.cattlePopulation) * 100).toFixed(2)}% of cattle.`
                  : "No cattle infections predicted."
              }
              tone="good"
            />
            <Kpi
              label="Environmental factor F_env"
              value={env.F_env.toFixed(3)}
              note={`Temperature ${env.f_T.toFixed(2)} × humidity ${env.f_H.toFixed(2)} × pH ${env.f_pH.toFixed(2)} (limited to 0–2).`}
            />
            <Kpi
              label="New cattle infections"
              value={formatCount(impact.infectionsWith)}
              note={`${formatCount(impact.withVaccination.deaths[impact.lastDay])} FMD deaths by day ${impact.lastDay}.`}
            />
          </dl>

          <section className="fmd-card" aria-labelledby="fmd-chart-heading">
            <div className="fmd-card-head">
              <h2 id="fmd-chart-heading">Epidemic curves</h2>
              <label className="fmd-check">
                <input
                  type="checkbox"
                  checked={logScale}
                  onChange={(event) => setLogScale(event.target.checked)}
                />
                Log scale
              </label>
            </div>
            <div className="fmd-legend" role="group" aria-label="Series shown">
              {SERIES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className="fmd-legend-item"
                  aria-pressed={visible.has(s.key)}
                  onClick={() => toggleSeries(s.key)}
                >
                  <svg
                    width="14"
                    height="14"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <rect width="14" height="14" rx="3" fill={s.color} />
                  </svg>
                  {s.label}
                </button>
              ))}
            </div>
            <EpidemicChart
              series={chartSeries}
              days={result.core.days}
              logScale={logScale}
              cursor={day}
              title="Simulated FMD epidemic curves"
              description={`${chartSeries.length} series over ${result.core.days} days. All infected animals peak at ${formatCount(peak.peak)} on day ${peak.peakDay}. The table below lists every compartment for the selected day.`}
            />
            <div className="fmd-cursor">
              <label htmlFor="fmd-day">Day shown in the table</label>
              <input
                id="fmd-day"
                type="range"
                min={0}
                max={result.core.days - 1}
                value={day}
                onChange={(event) => setCursor(Number(event.target.value))}
              />
              <output htmlFor="fmd-day">Day {day}</output>
              <button
                type="button"
                className="button secondary"
                onClick={() => setCursor(peak.peakDay)}
              >
                Go to peak (day {peak.peakDay})
              </button>
            </div>
          </section>

          <section className="fmd-card" aria-labelledby="fmd-day-heading">
            <h2 id="fmd-day-heading">Animals on day {day}</h2>
            <div className="fmd-day-summary">
              <p>
                All infected:{" "}
                <strong>{formatCount(result.infected[day])}</strong>
              </p>
              <p>
                New cattle infections so far:{" "}
                <strong>{formatCount(flowsAtDay.infections)}</strong>
              </p>
              <p>
                Averted so far by vaccination:{" "}
                <strong>{formatCount(Math.max(0, flowsAtDay.averted))}</strong>
              </p>
              <p>
                FMD deaths so far:{" "}
                <strong>{formatCount(flowsAtDay.deaths)}</strong>
              </p>
              <p>
                Cattle vaccinated so far:{" "}
                <strong>{formatCount(flowsAtDay.vaccinated)}</strong>
              </p>
            </div>
            <div className="fmd-table-grid">
              {HOST_ROWS.map((block) => (
                <table key={block.host} className="fmd-table">
                  <caption>{block.host}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Compartment</th>
                      <th scope="col">Animals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map(([key, label]) => (
                      <tr key={key}>
                        <th scope="row">
                          {label} <span className="fmd-symbol">{key}</span>
                        </th>
                        <td>{formatCount(result.core.series[key][day])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          </section>

          <section className="fmd-card" aria-labelledby="fmd-vacc-heading">
            <h2 id="fmd-vacc-heading">
              Vaccination impact over {impact.lastDay} days
            </h2>
            <p className="fmd-muted">
              Compares the current settings with no vaccination at all and with
              the day-0 vaccinated stock only (α_C = 0).
            </p>
            <dl className="fmd-facts">
              <div>
                <dt>Infections without vaccination</dt>
                <dd>{formatCount(impact.infectionsWithout)}</dd>
              </div>
              <div>
                <dt>Infections with current vaccination</dt>
                <dd>{formatCount(impact.infectionsWith)}</dd>
              </div>
              <div>
                <dt>Infections averted</dt>
                <dd>{formatCount(impact.saved)}</dd>
              </div>
              <div>
                <dt>Deaths averted</dt>
                <dd>{formatCount(impact.deathsAverted)}</dd>
              </div>
              <div>
                <dt>From the day-0 vaccinated stock</dt>
                <dd>{formatCount(impact.fromStock)}</dd>
              </div>
              <div>
                <dt>From the ongoing campaign (α_C)</dt>
                <dd>{formatCount(impact.fromCampaign)}</dd>
              </div>
              <div>
                <dt>Cattle vaccinated</dt>
                <dd>{formatCount(impact.vaccinated)}</dd>
              </div>
              <div>
                <dt>Vaccinated per infection averted</dt>
                <dd>
                  {impact.numberNeededToVaccinate === null
                    ? "—"
                    : impact.numberNeededToVaccinate.toFixed(1)}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="fmd-card fmd-downloads"
            aria-labelledby="fmd-export-heading"
          >
            <h2 id="fmd-export-heading">Export</h2>
            <p className="fmd-muted">
              Files are created in your browser; nothing is uploaded.
            </p>
            <div className="fmd-actions">
              <button
                type="button"
                className="button primary"
                onClick={() =>
                  downloadText(`fmd-results-${stamp}.csv`, resultsCsv(result))
                }
              >
                Download daily results (CSV)
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  downloadText(
                    `fmd-parameters-${stamp}.csv`,
                    parametersCsv(result),
                  )
                }
              >
                Download parameters (CSV)
              </button>
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
