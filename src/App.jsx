import { useMemo, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { signals, sourcesByCountry } from "./data.js";

const priorities = ["Todas", "Alta", "Media"];
const heroImage = require("../assets/geopol-hero.png");

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function signalId(item) {
  return normalizeText(`${item.country}-${item.source}-${item.topic}`).replace(/[^a-z0-9]+/g, "-");
}

export default function App() {
  const [country, setCountry] = useState("Todos");
  const [topic, setTopic] = useState("Todos");
  const [priority, setPriority] = useState("Todas");
  const [query, setQuery] = useState("");
  const [watchIds, setWatchIds] = useState(new Set());
  const { width } = useWindowDimensions();
  const isTablet = width >= 760;

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
      return next;
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Header />
        <Hero isTablet={isTablet} metrics={metrics} />

        <View style={styles.section}>
          <SectionHeader
            eyebrow="Monitor de análisis"
            meta={`Actualizado: ${updatedAt}`}
            title="Señales políticas priorizadas"
          />

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar país, tema o fuente"
            placeholderTextColor="#7f8984"
            style={styles.searchInput}
          />

          <FilterRail label="País" options={countries} selected={country} onSelect={setCountry} />
          <FilterRail label="Tema" options={topics} selected={topic} onSelect={setTopic} />
          <Segmented options={priorities} selected={priority} onSelect={setPriority} />

          <View style={[styles.monitorLayout, isTablet && styles.monitorLayoutWide]}>
            <View style={styles.feedColumn}>
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
                <EmptyState text="No hay señales con esos filtros." />
              )}
            </View>

            <Briefing watchedSignals={watchedSignals} />
          </View>
        </View>

        <Coverage isTablet={isTablet} />
        <Sources isTablet={isTablet} />
        <Method isTablet={isTablet} />

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>GeoPol Inteligencia</Text>
          <Text style={styles.footerText}>Portal base para agregación RSS/API y revisión analítica.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>GI</Text>
      </View>
      <View style={styles.brandCopy}>
        <Text style={styles.brandTitle}>GeoPol Inteligencia</Text>
        <Text style={styles.brandSubtitle}>Monitor político iberoamericano</Text>
      </View>
    </View>
  );
}

function Hero({ isTablet, metrics }) {
  return (
    <View style={[styles.hero, isTablet && styles.heroWide]}>
      <Image source={heroImage} style={styles.heroImage} />
      <View style={styles.heroOverlay} />
      <View style={[styles.heroContent, isTablet && styles.heroContentWide]}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>España e Hispanoamérica</Text>
          <Text style={[styles.heroTitle, isTablet && styles.heroTitleWide]}>GeoPol Inteligencia</Text>
          <Text style={styles.lede}>
            Un tablero operativo para seguir señales políticas, comparar fuentes por país y priorizar cambios de poder,
            elecciones, reformas, seguridad y diplomacia regional.
          </Text>
        </View>

        <View style={styles.commandPanel}>
          <View style={styles.panelHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.panelHeaderText}>Centro de situación</Text>
          </View>
          <View style={styles.metrics}>
            <Metric value={metrics.countries} label="países" />
            <Metric value={metrics.sources} label="fuentes" />
            <Metric value={metrics.alerts} label="prioridad alta" />
          </View>
          <View style={styles.signalStrip}>
            {["Gobernabilidad", "Elecciones", "Seguridad", "Diplomacia"].map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function SignalCard({ index, isWatching, item, onToggle }) {
  return (
    <View style={styles.newsCard}>
      <View style={styles.cardTopline}>
        <View style={styles.rank}>
          <Text style={styles.rankText}>{String(index + 1).padStart(2, "0")}</Text>
        </View>
        <View style={styles.metaLine}>
          <Text style={[styles.priority, item.priority === "Alta" ? styles.priorityHigh : styles.priorityMedium]}>
            {item.priority}
          </Text>
          <Tag>{item.country}</Tag>
          <Tag>{item.source}</Tag>
          <Tag>{item.topic}</Tag>
        </View>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSummary}>{item.summary}</Text>
      <View style={styles.cardActions}>
        <Pressable onPress={onToggle} style={styles.actionButton}>
          <Text style={styles.actionText}>{isWatching ? "Quitar" : "Seguir"}</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(item.url)} style={styles.actionButton}>
          <Text style={styles.actionText}>Abrir</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Briefing({ watchedSignals }) {
  return (
    <View style={styles.briefing}>
      <Text style={styles.sideTitle}>Cola del analista</Text>
      <View style={styles.watchList}>
        {watchedSignals.length ? (
          watchedSignals.map((item) => (
            <View style={styles.watchItem} key={signalId(item)}>
              <Text style={styles.watchTitle}>
                {item.country}: {item.topic}
              </Text>
              <Text style={styles.watchMeta}>
                {item.source} - {item.priority}
              </Text>
            </View>
          ))
        ) : (
          <EmptyState text="Marca señales para seguimiento." />
        )}
      </View>
    </View>
  );
}

function Coverage({ isTablet }) {
  return (
    <View style={styles.coverageBand}>
      <SectionHeader eyebrow="Cobertura territorial" title="Mapa operativo de países" />
      <View style={[styles.countryGrid, isTablet && styles.countryGridWide]}>
        {sourcesByCountry.map((item) => {
          const activeSignals = signals.filter((signal) => signal.country === item.country);
          const score = Math.min(100, 24 + item.sources.length * 9 + activeSignals.length * 18);

          return (
            <View style={[styles.countryTile, isTablet && styles.countryTileWide]} key={item.country}>
              <Text style={styles.tileTitle}>{item.country}</Text>
              <View style={styles.tileRow}>
                <Text style={styles.tileMeta}>{item.region}</Text>
                <Text style={styles.tileMeta}>{item.sources.length} fuentes</Text>
              </View>
              <View style={styles.tileRow}>
                <Text style={styles.tileMeta}>{activeSignals.length} señales</Text>
                <Text style={styles.tileMeta}>{score}%</Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${score}%` }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Sources({ isTablet }) {
  return (
    <View style={styles.section}>
      <SectionHeader eyebrow="Directorio editorial" title="Fuentes políticas por país" />
      <View style={[styles.sourceDirectory, isTablet && styles.sourceDirectoryWide]}>
        {sourcesByCountry.map((country) => (
          <View style={[styles.sourceCard, isTablet && styles.sourceCardWide]} key={country.country}>
            <Text style={styles.sourceCountry}>{country.country}</Text>
            <View style={styles.sourceList}>
              {country.sources.map(([name, type, url]) => (
                <View style={styles.sourceRow} key={`${country.country}-${name}`}>
                  <View style={styles.sourceCopy}>
                    <Text style={styles.sourceName}>{name}</Text>
                    <Text style={styles.sourceType}>{type}</Text>
                  </View>
                  <Pressable onPress={() => Linking.openURL(url)} style={styles.smallButton}>
                    <Text style={styles.actionText}>Abrir</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Method({ isTablet }) {
  return (
    <View style={styles.section}>
      <SectionHeader eyebrow="Método" title="Criterios de seguimiento" />
      <View style={[styles.methodGrid, isTablet && styles.methodGridWide]}>
        <MethodCard
          number="01"
          text="Priorización de cambios con impacto en gobiernos, congresos, tribunales, partidos y órganos electorales."
          title="Relevancia institucional"
        />
        <MethodCard
          number="02"
          text="Lectura cruzada entre prensa nacional, medios de investigación, portales económicos y fuentes regionales."
          title="Contraste regional"
        />
        <MethodCard
          number="03"
          text="Clasificación por estabilidad, conflictividad, agenda legislativa, seguridad pública y alineamientos exteriores."
          title="Riesgo político"
        />
      </View>
    </View>
  );
}

function FilterRail({ label, onSelect, options, selected }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        {options.map((item) => (
          <Pressable
            key={item}
            onPress={() => onSelect(item)}
            style={[styles.filterChip, selected === item && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selected === item && styles.filterChipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Segmented({ onSelect, options, selected }) {
  return (
    <View style={styles.segmented}>
      {options.map((item) => (
        <Pressable key={item} onPress={() => onSelect(item)} style={[styles.segment, selected === item && styles.segmentActive]}>
          <Text style={[styles.segmentText, selected === item && styles.segmentTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionHeader({ eyebrow, meta, title }) {
  return (
    <View style={styles.sectionHeading}>
      <View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {meta ? <Text style={styles.timestamp}>{meta}</Text> : null}
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Tag({ children }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{children}</Text>
    </View>
  );
}

function EmptyState({ text }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function MethodCard({ number, text, title }) {
  return (
    <View style={styles.methodCard}>
      <Text style={styles.methodNumber}>{number}</Text>
      <Text style={styles.methodTitle}>{title}</Text>
      <Text style={styles.methodText}>{text}</Text>
    </View>
  );
}

const colors = {
  ink: "#f6f4ee",
  muted: "#b8c2bd",
  soft: "rgba(246, 244, 238, 0.74)",
  bg: "#101312",
  line: "rgba(246, 244, 238, 0.14)",
  teal: "#2dc5b3",
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { backgroundColor: colors.bg, paddingBottom: 28 },
  header: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "rgba(45, 197, 179, 0.12)",
    borderColor: "rgba(45, 197, 179, 0.48)",
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  brandMarkText: { color: colors.teal, fontSize: 15, fontWeight: "800" },
  brandCopy: { flex: 1 },
  brandTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  brandSubtitle: { color: colors.muted, fontSize: 12, marginTop: 1 },
  hero: { minHeight: 620, overflow: "hidden", position: "relative" },
  heroWide: { minHeight: 700 },
  heroImage: { height: "100%", position: "absolute", resizeMode: "cover", width: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16, 19, 18, 0.66)" },
  heroContent: { gap: 24, justifyContent: "center", minHeight: 620, paddingHorizontal: 18, paddingVertical: 44 },
  heroContentWide: { alignItems: "center", flexDirection: "row", gap: 38, minHeight: 700, paddingHorizontal: 48 },
  heroCopy: { flex: 1 },
  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 9,
    textTransform: "uppercase",
  },
  heroTitle: { color: colors.ink, fontSize: 58, fontWeight: "900", letterSpacing: 0, lineHeight: 55, maxWidth: 360 },
  heroTitleWide: { fontSize: 90, lineHeight: 82, maxWidth: 560 },
  lede: { color: colors.soft, fontSize: 17, lineHeight: 25, marginTop: 18, maxWidth: 720 },
  commandPanel: {
    backgroundColor: "rgba(23, 27, 25, 0.88)",
    borderColor: colors.line,
    borderWidth: 1,
    flex: 1,
    gap: 18,
    maxWidth: 420,
    padding: 20,
  },
  panelHeader: { alignItems: "center", flexDirection: "row", gap: 10 },
  liveDot: { backgroundColor: colors.teal, borderRadius: 99, height: 9, width: 9 },
  panelHeaderText: { color: colors.muted, fontSize: 13 },
  metrics: { flexDirection: "row", gap: 10 },
  metric: { borderLeftColor: colors.line, borderLeftWidth: 1, flex: 1, paddingLeft: 12 },
  metricValue: { color: colors.ink, fontSize: 34, fontWeight: "900", lineHeight: 38 },
  metricLabel: { color: colors.muted, fontSize: 12 },
  signalStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  section: { paddingHorizontal: 18, paddingVertical: 42 },
  coverageBand: {
    backgroundColor: "#121614",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 42,
  },
  sectionHeading: { gap: 12, marginBottom: 22 },
  sectionTitle: { color: colors.ink, fontSize: 30, fontWeight: "900", letterSpacing: 0, lineHeight: 32 },
  timestamp: { color: colors.muted, fontSize: 13 },
  searchInput: {
    backgroundColor: "#121614",
    borderColor: colors.line,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    height: 48,
    marginBottom: 16,
    paddingHorizontal: 14,
  },
  filterGroup: { gap: 8, marginBottom: 14 },
  filterLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  filterRail: { gap: 8, paddingRight: 18 },
  filterChip: {
    backgroundColor: "rgba(246, 244, 238, 0.06)",
    borderColor: colors.line,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterChipActive: { backgroundColor: "rgba(45, 197, 179, 0.14)", borderColor: "rgba(45, 197, 179, 0.54)" },
  filterChipText: { color: colors.muted, fontSize: 13 },
  filterChipTextActive: { color: colors.ink, fontWeight: "800" },
  segmented: { borderColor: colors.line, borderWidth: 1, flexDirection: "row", marginBottom: 20 },
  segment: {
    alignItems: "center",
    borderRightColor: colors.line,
    borderRightWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  segmentActive: { backgroundColor: "rgba(45, 197, 179, 0.14)" },
  segmentText: { color: colors.muted, fontSize: 14 },
  segmentTextActive: { color: colors.ink, fontWeight: "800" },
  monitorLayout: { gap: 16 },
  monitorLayoutWide: { alignItems: "flex-start", flexDirection: "row" },
  feedColumn: { flex: 1, gap: 12 },
  newsCard: { backgroundColor: "rgba(23, 27, 25, 0.88)", borderColor: colors.line, borderWidth: 1, gap: 12, padding: 16 },
  cardTopline: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  rank: {
    alignItems: "center",
    borderColor: "rgba(246, 244, 238, 0.18)",
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  rankText: { color: colors.muted, fontWeight: "900" },
  metaLine: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: {
    backgroundColor: "rgba(246, 244, 238, 0.06)",
    borderColor: colors.line,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tagText: { color: colors.soft, fontSize: 12 },
  priority: { borderWidth: 1, fontSize: 12, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 6 },
  priorityHigh: { borderColor: "rgba(212, 91, 79, 0.54)", color: "#ffc9c3" },
  priorityMedium: { borderColor: "rgba(214, 166, 71, 0.5)", color: "#ffe0a0" },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", lineHeight: 23 },
  cardSummary: { color: colors.soft, fontSize: 14, lineHeight: 21 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionButton: {
    alignItems: "center",
    backgroundColor: "rgba(246, 244, 238, 0.06)",
    borderColor: colors.line,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: "rgba(246, 244, 238, 0.06)",
    borderColor: colors.line,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 10,
  },
  actionText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  briefing: {
    backgroundColor: "rgba(23, 27, 25, 0.88)",
    borderColor: colors.line,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    width: Platform.select({ web: 360, default: "100%" }),
  },
  sideTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  watchList: { gap: 10 },
  watchItem: { backgroundColor: "rgba(246, 244, 238, 0.05)", borderLeftColor: colors.teal, borderLeftWidth: 2, padding: 11 },
  watchTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  watchMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  emptyState: { backgroundColor: "rgba(246, 244, 238, 0.05)", borderLeftColor: colors.teal, borderLeftWidth: 2, padding: 12 },
  emptyText: { color: colors.muted, fontSize: 13 },
  countryGrid: { gap: 10 },
  countryGridWide: { flexDirection: "row", flexWrap: "wrap" },
  countryTile: { backgroundColor: "rgba(246, 244, 238, 0.035)", borderColor: colors.line, borderWidth: 1, gap: 9, minHeight: 112, padding: 14 },
  countryTileWide: { width: "24%" },
  tileTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  tileRow: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  tileMeta: { color: colors.muted, fontSize: 12 },
  bar: { backgroundColor: "rgba(246, 244, 238, 0.1)", height: 4, marginTop: 4 },
  barFill: { backgroundColor: colors.teal, height: "100%" },
  sourceDirectory: { gap: 12 },
  sourceDirectoryWide: { flexDirection: "row", flexWrap: "wrap" },
  sourceCard: { backgroundColor: "rgba(23, 27, 25, 0.88)", borderColor: colors.line, borderWidth: 1, padding: 16 },
  sourceCardWide: { width: "32%" },
  sourceCountry: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 10 },
  sourceList: { gap: 9 },
  sourceRow: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", paddingTop: 9 },
  sourceCopy: { flex: 1 },
  sourceName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  sourceType: { color: colors.muted, fontSize: 12, marginTop: 1 },
  methodGrid: { gap: 12 },
  methodGridWide: { flexDirection: "row" },
  methodCard: { backgroundColor: "rgba(23, 27, 25, 0.88)", borderColor: colors.line, borderWidth: 1, flex: 1, padding: 18 },
  methodNumber: { color: colors.teal, fontSize: 14, fontWeight: "900", marginBottom: 8 },
  methodTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 8 },
  methodText: { color: colors.soft, fontSize: 14, lineHeight: 21 },
  footer: { borderTopColor: colors.line, borderTopWidth: 1, gap: 5, paddingHorizontal: 18, paddingTop: 20 },
  footerBrand: { color: colors.ink, fontWeight: "900" },
  footerText: { color: colors.muted, fontSize: 12 },
});
