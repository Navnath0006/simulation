import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import {
  groups,
  modules,
  findModule,
  filterModules,
  type ModuleGroup,
  type PortalModule,
} from "./data/modules";
import { people, contact, type Team } from "./data/people";
import { assetUrl, parseRoute, type Route } from "./navigation";

function Arrow({ external = false }: { external?: boolean }) {
  return <span aria-hidden="true">{external ? "↗" : "→"}</span>;
}

function ModuleCard({ entry }: { entry: PortalModule }) {
  return (
    <a
      className={`module-card group-${entry.group}`}
      href={`#/modules/${entry.id}`}
    >
      <div className="card-top">
        <span className="module-symbol">{entry.shortName}</span>
        <Arrow />
      </div>
      <span className="eyebrow">{groups[entry.group].label}</span>
      <h3>{entry.name}</h3>
      <p>{entry.description}</p>
      <span className="card-footer">
        View information <span className="quiet-badge">Directory</span>
      </span>
    </a>
  );
}

function AvailabilityNotice() {
  return (
    <aside className="availability-note" aria-label="Availability">
      <span className="notice-icon" aria-hidden="true">
        i
      </span>
      <p>
        <strong>Directory and contact information are available.</strong>{" "}
        Scientific simulation engines are not included in this version.
      </p>
    </aside>
  );
}

function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">ICAR-NIVEDI · Bengaluru</p>
          <h1>
            One place for
            <br />
            <em>disease research.</em>
          </h1>
          <p className="hero-description">
            Explore the module directory, discover our research teams, and find
            the right technical contact.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#/modules">
              Explore the directory <Arrow />
            </a>
            <a className="button secondary" href="#/team">
              Meet the team
            </a>
          </div>
        </div>
        <div className="hero-panel" aria-label="Research directory summary">
          <div className="panel-label">
            <span className="small-dot" /> Research directory
          </div>
          {Object.entries(groups).map(([key, group]) => (
            <a
              key={key}
              className={`group-row group-${key}`}
              href={`#/modules?group=${key}`}
            >
              <span className="group-mark" aria-hidden="true">
                {key === "livestock" ? "L" : key === "swine" ? "S" : "Z"}
              </span>
              <span>
                <strong>{group.label}</strong>
                <small>{group.description}</small>
              </span>
              <span className="group-count">
                {modules.filter((entry) => entry.group === key).length}
              </span>
            </a>
          ))}
          <div className="panel-foot">Animal health. Shared knowledge.</div>
        </div>
      </section>
      <AvailabilityNotice />
      <section className="section" aria-labelledby="featured-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Explore the portal</p>
            <h2 id="featured-heading">Module directory</h2>
          </div>
          <a className="text-link" href="#/modules">
            View all {modules.length} entries <Arrow />
          </a>
        </div>
        <div className="card-grid">
          {modules
            .filter((entry) => ["fmd", "asf", "je"].includes(entry.id))
            .map((entry) => (
              <ModuleCard key={entry.id} entry={entry} />
            ))}
        </div>
      </section>
      <section className="support-banner">
        <div>
          <p className="eyebrow">People behind the portal</p>
          <h2>Research starts with collaboration.</h2>
          <p>
            Connect with the scientists and application development team at
            ICAR-NIVEDI.
          </p>
        </div>
        <a className="button secondary" href="#/contact">
          Contact the team <Arrow />
        </a>
      </section>
    </>
  );
}

function DirectoryPage({
  initialGroup,
}: {
  initialGroup: ModuleGroup | "all";
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ModuleGroup | "all">(initialGroup);
  const result = filterModules(query, group);
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Research directory</p>
        <h1>Explore the modules</h1>
        <p>Browse by research group or search for a disease name.</p>
      </div>
      <AvailabilityNotice />
      <div className="directory-layout">
        <aside className="filters" aria-label="Filter directory">
          <label className="search-label" htmlFor="module-search">
            Search modules
          </label>
          <input
            id="module-search"
            className="search-input"
            type="search"
            placeholder="Name or abbreviation…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <fieldset>
            <legend>Research group</legend>
            {(["all", "livestock", "swine", "zoonotic"] as const).map((key) => (
              <label
                key={key}
                className={`filter-option ${group === key ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="group"
                  value={key}
                  checked={group === key}
                  onChange={() => setGroup(key)}
                />
                <span>{key === "all" ? "All modules" : groups[key].label}</span>
                <span className="filter-count">
                  {key === "all"
                    ? modules.length
                    : modules.filter((entry) => entry.group === key).length}
                </span>
              </label>
            ))}
          </fieldset>
        </aside>
        <div className="directory-results">
          <p className="results-count" role="status" aria-live="polite">
            {result.length} {result.length === 1 ? "entry" : "entries"}
            {query ? ` matching “${query}”` : ""}
          </p>
          {result.length ? (
            <div className="card-grid directory-grid">
              {result.map((entry) => (
                <ModuleCard key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No matching modules</h2>
              <p>Try another name or select a different research group.</p>
              <button
                className="button secondary"
                onClick={() => {
                  setQuery("");
                  setGroup("all");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ModulePage({ id }: { id: string }) {
  const entry = findModule(id);
  if (!entry) return <NotFoundPage />;
  return (
    <>
      <a className="back-link" href="#/modules">
        ← Module directory
      </a>
      <div className={`module-detail group-${entry.group}`}>
        <div className="detail-heading">
          <span className="module-symbol large">{entry.shortName}</span>
          <div>
            <p className="eyebrow">{groups[entry.group].label}</p>
            <h1>{entry.name}</h1>
            <p>{entry.description}</p>
          </div>
        </div>
        <section
          className="unavailable-panel"
          aria-labelledby="availability-heading"
        >
          <span className="quiet-badge">Information only</span>
          <h2 id="availability-heading">
            Simulation not available in this version
          </h2>
          <p>
            This entry identifies a module from the existing research portal.
            Its scientific engine, calculations, reports, and datasets are not
            included in this React application.
          </p>
          <a className="button primary" href="#/contact">
            Find a technical contact <Arrow />
          </a>
        </section>
        <p className="detail-footnote">
          This directory entry does not indicate scientific validation or
          clinical approval.
        </p>
      </div>
    </>
  );
}

const teamLabels: Record<Team, string> = {
  scientists: "Scientists Team",
  modelling: "Mathematical Modelling Development Team",
  application: "Application Development Team",
};
function TeamPage() {
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">The people behind the portal</p>
        <h1>Meet the team</h1>
        <p>
          Scientists, researchers, and developers working together at
          ICAR-NIVEDI.
        </p>
      </div>
      {(Object.keys(teamLabels) as Team[]).map((team) => (
        <section
          className="section team-section"
          key={team}
          aria-labelledby={`team-${team}`}
        >
          <div className="section-heading">
            <h2 id={`team-${team}`}>{teamLabels[team]}</h2>
            <span className="section-count">
              {people.filter((person) => person.team === team).length} members
            </span>
          </div>
          <div className="people-grid">
            {people
              .filter((person) => person.team === team)
              .map((person) => (
                <article className="person-card" key={person.id}>
                  <div className="portrait-wrap">
                    <img
                      src={assetUrl(person.image)}
                      alt={person.name}
                      loading="lazy"
                      width="300"
                      height="320"
                    />
                  </div>
                  <div className="person-copy">
                    <h3>{person.name}</h3>
                    <p>{person.role}</p>
                    {person.profileUrl && (
                      <a
                        className="text-link"
                        href={person.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Institute profile <Arrow external />
                      </a>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}

function ContactPage() {
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">We’re here to help</p>
        <h1>{contact.title}</h1>
        <p>Reach out to the scientific team or the Disease Informatics Lab.</p>
      </div>
      <div className="contact-grid">
        {contact.technicalContacts.map((person) => (
          <section className="contact-card" key={person.email}>
            <span className="eyebrow">Technical contact</span>
            <h2>{person.name}</h2>
            <p>{person.role}</p>
            <a className="contact-link" href={`mailto:${person.email}`}>
              {person.email} <Arrow external />
            </a>
          </section>
        ))}
      </div>
      <section className="technical-card">
        <div className="technical-mark" aria-hidden="true">
          @
        </div>
        <div>
          <p className="eyebrow">Portal support</p>
          <h2>{contact.technicalIssues.title}</h2>
          <p>{contact.technicalIssues.organization}</p>
          <div className="contact-actions">
            <a href={`mailto:${contact.technicalIssues.email}`}>
              {contact.technicalIssues.email} <Arrow external />
            </a>
            <a href={`tel:${contact.technicalIssues.phone}`}>
              {contact.technicalIssues.phone}
            </a>
          </div>
        </div>
      </section>
      <p className="contact-note">
        Email links open your email application. This website does not collect
        or store feedback submissions.
      </p>
    </>
  );
}

function NotFoundPage() {
  return (
    <section className="empty-state not-found">
      <span className="eyebrow">404 · Page not found</span>
      <h1>Let’s get you back on track.</h1>
      <p>This page or module is not available in the portal.</p>
      <a className="button primary" href="#/">
        Back to home <Arrow />
      </a>
    </section>
  );
}

class PageErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="empty-state" role="alert">
        <h1>The page could not be displayed.</h1>
        <p>Please reload the portal and try again.</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
function readRoute(): Route {
  return parseRoute(window.location.hash.split("?")[0], window.location.search);
}
function readGroup(): ModuleGroup | "all" {
  const group = new URLSearchParams(
    window.location.hash.split("?")[1] || "",
  ).get("group");
  return group === "livestock" || group === "swine" || group === "zoonotic"
    ? group
    : "all";
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [group, setGroup] = useState(readGroup);
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const activePage = route.page === "module" ? "modules" : route.page;
  useEffect(() => {
    const changeRoute = () => {
      setRoute(readRoute());
      setGroup(readGroup());
      setMenuOpen(false);
      requestAnimationFrame(() => {
        mainRef.current?.focus();
        window.scrollTo(0, 0);
      });
    };
    window.addEventListener("hashchange", changeRoute);
    return () => window.removeEventListener("hashchange", changeRoute);
  }, []);
  useEffect(() => {
    const titles: Record<string, string> = {
      home: "Disease Simulation Portal",
      modules: "Module directory",
      team: "Our team",
      contact: "Contact",
      "not-found": "Page not found",
    };
    const title =
      route.page === "module" ? findModule(route.id)?.name : titles[route.page];
    document.title = `${title || "Portal"} | ICAR-NIVEDI`;
  }, [route]);
  useEffect(() => {
    const escapeMenu = (event: KeyboardEvent) => {
      if (menuOpen && event.key === "Escape") {
        setMenuOpen(false);
        menuRef.current?.focus();
      }
    };
    window.addEventListener("keydown", escapeMenu);
    return () => window.removeEventListener("keydown", escapeMenu);
  }, [menuOpen]);
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="institution-strip">
        <div className="container">
          <span>Indian Council of Agricultural Research</span>
          <a
            href="https://nivedi.res.in/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Institute website <Arrow external />
          </a>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <a href="#/" className="brand" aria-label="ICAR-NIVEDI portal home">
            <img
              src={assetUrl("assets/icar-logo.png")}
              alt="ICAR"
              width="52"
              height="60"
            />
            <span>
              <strong>Disease Simulation Portal</strong>
              <small>ICAR · NIVEDI</small>
            </span>
          </a>
          <button
            ref={menuRef}
            type="button"
            className="menu-button"
            aria-controls="main-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? "Close menu ×" : "Menu ☰"}
          </button>
          <nav
            id="main-navigation"
            className={`navigation ${menuOpen ? "is-open" : ""}`}
            aria-label="Main navigation"
          >
            {[
              ["home", "#/", "Home"],
              ["modules", "#/modules", "Modules"],
              ["team", "#/team", "Team"],
              ["contact", "#/contact", "Contact us"],
            ].map(([key, href, label]) => (
              <a
                key={key}
                href={href}
                aria-current={activePage === key ? "page" : undefined}
                onClick={() => {
                  setMenuOpen(false);
                  if (window.location.hash === href) mainRef.current?.focus();
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        className="container main-content"
        ref={mainRef}
        tabIndex={-1}
      >
        <PageErrorBoundary
          key={route.page === "module" ? route.id : route.page}
        >
          {route.page === "home" && <HomePage />}
          {route.page === "modules" && (
            <DirectoryPage key={group} initialGroup={group} />
          )}
          {route.page === "module" && <ModulePage id={route.id} />}
          {route.page === "team" && <TeamPage />}
          {route.page === "contact" && <ContactPage />}
          {route.page === "not-found" && <NotFoundPage />}
        </PageErrorBoundary>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <strong>ICAR-NIVEDI</strong>
            <p>
              National Institute of Veterinary Epidemiology
              <br />
              and Disease Informatics, Bengaluru
            </p>
          </div>
          <div className="footer-right">
            <a href="#/contact">
              Contact the team <Arrow />
            </a>
            <p>© {new Date().getFullYear()} ICAR-NIVEDI</p>
          </div>
        </div>
      </footer>
    </>
  );
}
