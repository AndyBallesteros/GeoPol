import { useMemo, useState } from "react";
import { signals, sourcesByCountry } from "./data.js";

const priorities = ["Todas", "Alta", "Media"];

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function signalId(item) {
  return normalizeText(`${item.country}-${item.source}-${item.topic}`).replace(/[^a-z0-9]+/g, "-");
}

function getInitialWatchIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem("geopol-watchlist") || "[]"));
  } catch {
    return new Set();
  }
}

export default function App() {
  const [country, setCountry] = useState("Todos");
  const [topic, setTopic] = useState("Todos");
  const [priority, setPriority] = useState("Todas");
  const [query, setQuery] = useState("");
  const [watchIds, setWatchIds] = useState(getInitialWatchIds);

  const countries = useMemo(
    () => ["Todos", ...sourcesByCountry.map((item) => item.country).sort((a, b) => a.localeCompare(b))],
    []
  );

  const topics = useMemo(
    () =>
      ["Todos", ...new Set(signals.map((item) => item.topic))].sort((a, b) =>
        a === "Todos" ? -1 : b === "Todos" ? 1 : a.localeCompare(b)
      ),
    []
  );

  const filteredSignals = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());

    return signals.filter((item) => {
      const queryBlob = normalizeText(`${item.country} ${item.source} ${item.topic} ${item.title} ${item.summary}`);

      return (
        (country === "Todos" || item.country === country) &&
        (topic === "Todos" || item.topic === topic) &&
        (priority === "Todas" || item.priority === priority) &&
        (!normalizedQuery || queryBlob.includes(normalizedQuery))
      );
    });
  }, [country, topic, priority, query]);

  const watchedSignals = useMemo(() => signals.filter((item) => watchIds.has(signalId(item))), [watchIds]);

  const metrics = useMemo(
    () => ({
      countries: sourcesByCountry.length,
      sources: sourcesByCountry.reduce((total, item) => total + item.sources.length, 0),
      alerts: signals.filter((item) => item.priority === "Alta").length,
    }),
    []
  );

  const updatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
    []
  );

  function toggleWatch(id) {
    setWatchIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem("geopol-watchlist", JSON.stringify([...next]));
      return next;
    });
  }

  return (
    <>
      <Header />

      <main id="inicio">
        <Hero metrics={metrics} />

        <section className="workspace" id="monitor" aria-labelledby="monitor-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Monitor de análisis</p>
              <h2 id="monitor-title">Señales políticas priorizadas</h2>
            </div>
            <div className="timestamp">Actualizado: {updatedAt}</div>
          </div>

          <div className="toolbar" aria-label="Filtros del monitor">
            <label className="search-field">
              <span>Buscar</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="país, tema o fuente"
              />
            </label>

            <label>
              <span>País</span>
              <select value={country} onChange={(event) => setCountry(event.target.value)}>
                {countries.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Tema</span>
              <select value={topic} onChange={(event) => setTopic(event.target.value)}>
                {topics.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="segmented" role="group" aria-label="Prioridad">
              {priorities.map((item) => (
                <button
                  className={priority === item ? "is-active" : ""}
                  key={item}
                  onClick={() => setPriority(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="monitor-layout">
            <section className="feed" aria-label="Listado de señales">
              <div className="news-list">
                {filteredSignals.length ? (
                  filteredSignals.map((item, index) => (
                    <SignalCard
                      index={index}
                      isWatching={watchIds.has(signalId(item))}
                      item={item}
                      key={signalId(item)}
                      onToggle={() => toggleWatch(signalId(item))}
                    />
                  ))
                ) : (
                  <div className="empty-state">No hay señales con esos filtros.</div>
                )}
              </div>
            </section>

            <Briefing watchedSignals={watchedSignals} />
          </div>
        </section>

        <Coverage />
        <Sources />
        <Method />
      </main>

      <footer className="footer">
        <span>GeoPol Inteligencia</span>
        <span>Portal base para agregación RSS/API y revisión analítica.</span>
      </footer>
    </>
  );
}

function Header() {
  return (
    <header className="topbar">
      <a className="brand" href="#inicio" aria-label="GeoPol Inteligencia">
        <span className="brand-mark">GI</span>
        <span>
          <strong>GeoPol Inteligencia</strong>
          <small>Monitor político iberoamericano</small>
        </span>
      </a>
      <nav className="nav" aria-label="Navegación principal">
        <a href="#monitor">Monitor</a>
        <a href="#fuentes">Fuentes</a>
        <a href="#mapa">Cobertura</a>
        <a href="#metodo">Método</a>
      </nav>
    </header>
  );
}

function Hero({ metrics }) {
  return (
    <section className="hero" aria-labelledby="page-title">
      <img src="/assets/geopol-hero.png" alt="" className="hero-image" />
      <div className="hero-scrim" />

      <div className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">España e Hispanoamérica</p>
          <h1 id="page-title">GeoPol Inteligencia</h1>
          <p className="lede">
            Un tablero operativo para seguir señales políticas, comparar fuentes por país y priorizar cambios de poder,
            elecciones, reformas, seguridad y diplomacia regional.
          </p>
        </div>

        <aside className="command-panel" aria-label="Resumen del monitor">
          <div className="panel-header">
            <span className="live-dot" />
            <span>Centro de situación</span>
          </div>
          <dl className="metrics">
            <div>
              <dt>{metrics.countries}</dt>
              <dd>países</dd>
            </div>
            <div>
              <dt>{metrics.sources}</dt>
              <dd>fuentes</dd>
            </div>
            <div>
              <dt>{metrics.alerts}</dt>
              <dd>prioridad alta</dd>
            </div>
          </dl>
          <div className="signal-strip">
            <span>Gobernabilidad</span>
            <span>Elecciones</span>
            <span>Seguridad</span>
            <span>Diplomacia</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SignalCard({ index, isWatching, item, onToggle }) {
  return (
    <article className="news-card">
      <div className="rank">{String(index + 1).padStart(2, "0")}</div>
      <div>
        <div className="meta-line">
          <span className={`priority ${item.priority}`}>{item.priority}</span>
          <span className="tag">{item.country}</span>
          <span className="tag">{item.source}</span>
          <span className="topic-pill">{item.topic}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
      </div>
      <div className="card-actions">
        <button className="action-button" type="button" onClick={onToggle}>
          {isWatching ? "Quitar" : "Seguir"}
        </button>
        <a className="source-link" href={item.url} target="_blank" rel="noopener noreferrer">
          Abrir
        </a>
      </div>
    </article>
  );
}

function Briefing({ watchedSignals }) {
  return (
    <aside className="briefing" aria-labelledby="briefing-title">
      <h3 id="briefing-title">Cola del analista</h3>
      <div className="watch-list">
        {watchedSignals.length ? (
          watchedSignals.map((item) => (
            <div className="watch-item" key={signalId(item)}>
              <strong>
                {item.country}: {item.topic}
              </strong>
              <span>
                {item.source} - {item.priority}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">Marca señales para seguimiento.</div>
        )}
      </div>
    </aside>
  );
}

function Coverage() {
  return (
    <section className="coverage-band" id="mapa" aria-labelledby="coverage-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cobertura territorial</p>
          <h2 id="coverage-title">Mapa operativo de países</h2>
        </div>
      </div>
      <div className="country-grid">
        {sourcesByCountry.map((item) => {
          const activeSignals = signals.filter((signal) => signal.country === item.country);
          const score = Math.min(100, 24 + item.sources.length * 9 + activeSignals.length * 18);

          return (
            <article className="country-tile" key={item.country}>
              <strong>{item.country}</strong>
              <div>
                <span>{item.region}</span>
                <span>{item.sources.length} fuentes</span>
              </div>
              <div>
                <span>{activeSignals.length} señales</span>
                <span>{score}%</span>
              </div>
              <span className="bar">
                <span style={{ width: `${score}%` }} />
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Sources() {
  return (
    <section className="sources-section" id="fuentes" aria-labelledby="sources-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Directorio editorial</p>
          <h2 id="sources-title">Fuentes políticas por país</h2>
        </div>
      </div>
      <div className="source-directory">
        {sourcesByCountry.map((country) => (
          <article className="source-card" key={country.country}>
            <h3>{country.country}</h3>
            <div className="source-list">
              {country.sources.map(([name, type, url]) => (
                <div className="source-row" key={`${country.country}-${name}`}>
                  <div>
                    <strong>{name}</strong>
                    <br />
                    <span>{type}</span>
                  </div>
                  <a className="source-link" href={url} target="_blank" rel="noopener noreferrer">
                    Abrir
                  </a>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Method() {
  return (
    <section className="method-band" id="metodo" aria-labelledby="method-title">
      <div>
        <p className="eyebrow">Método</p>
        <h2 id="method-title">Criterios de seguimiento</h2>
      </div>
      <div className="method-grid">
        <article>
          <span>01</span>
          <h3>Relevancia institucional</h3>
          <p>Priorización de cambios con impacto en gobiernos, congresos, tribunales, partidos y órganos electorales.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Contraste regional</h3>
          <p>Lectura cruzada entre prensa nacional, medios de investigación, portales económicos y fuentes regionales.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Riesgo político</h3>
          <p>Clasificación por estabilidad, conflictividad, agenda legislativa, seguridad pública y alineamientos exteriores.</p>
        </article>
      </div>
    </section>
  );
}
