import FmdModel from "./FmdModel";
import FmdSimulator from "./FmdSimulator";
import "./fmd.css";

export type FmdView = "simulator" | "model";

const VIEWS: readonly [FmdView, string, string][] = [
  ["simulator", "#/modules/fmd", "Simulator"],
  ["model", "#/modules/fmd/model", "Model & validation"],
];

export default function FmdModule({ view }: { view: FmdView }) {
  return (
    <>
      <a className="back-link" href="#/modules">
        ← Module directory
      </a>
      <div className="fmd-header group-livestock">
        <span className="module-symbol large" aria-hidden="true">
          FMD
        </span>
        <div>
          <p className="eyebrow">Livestock · ODE simulator</p>
          <h1>Foot &amp; Mouth Disease</h1>
          <p>
            Multi-host transmission in cattle, buffalo, pigs and sheep/goats,
            with vaccination, isolation, seasonality and environmental effects.
          </p>
        </div>
      </div>
      <aside className="availability-note fmd-scope" aria-label="Scope">
        <span className="notice-icon" aria-hidden="true">
          i
        </span>
        <p>
          <strong>Core model migrated from the legacy portal.</strong> Results
          match the legacy engine exactly in the recorded validation scenarios.
          Several legacy panels and the spatial and SAT-1 simulators are not
          available yet; see{" "}
          <a className="text-link" href="#/modules/fmd/model">
            Model &amp; validation
          </a>
          . Outputs are model projections for planning, not observed data.
        </p>
      </aside>
      <nav className="fmd-tabs" aria-label="Foot & Mouth Disease views">
        {VIEWS.map(([key, href, label]) => (
          <a
            key={key}
            href={href}
            aria-current={view === key ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      {/* Both views stay mounted so simulator inputs survive switching tabs. */}
      <div hidden={view !== "simulator"}>
        <FmdSimulator />
      </div>
      <div hidden={view !== "model"}>
        <FmdModel />
      </div>
    </>
  );
}
