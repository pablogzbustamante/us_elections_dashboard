import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Layout from "../components/layout/Layout";
import StateMap from "../components/charts/StateMap";
import Spinner from "../components/ui/Spinner";
import IncomeQuintileChart from "../components/charts/IncomeQuintileChart";
import IncomeCompetitivenessChart from "../components/charts/IncomeCompetitivenessChart";
import EconomicStressChart from "../components/charts/EconomicStressChart";
import HousingAffordabilityChart, { AffordabilityLegend } from "../components/charts/HousingAffordabilityChart";
import IncomeSegmentChart from "../components/charts/IncomeSegmentChart";
import IncomePopulationChart, { IncomePopLegend } from "../components/charts/IncomePopulationChart";
import InequalityProxyChart from "../components/charts/InequalityProxyChart";
import PersuasionViolinChart from "../components/charts/PersuasionViolinChart";
import { dashboardService } from "../services/dashboardService";
import useElectionsStore from "../store/useElectionsStore";

/* ══════════════════════════════════════════════════════════════════════
   MapSearch
══════════════════════════════════════════════════════════════════════ */
const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

function MapSearch({ viewMode, stateMapData, countyMapData, onStateSelect, onCountySelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref  = useRef(null);
  const mode = viewMode === "states" ? "state" : "county";

  useEffect(() => { setQuery(""); setOpen(false); }, [viewMode]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (mode === "state")
      return [...stateMapData.values()]
        .filter(r => r.state_name?.toLowerCase().includes(q) || r.state_abbr?.toLowerCase().includes(q))
        .slice(0, 8);
    return [...countyMapData.values()]
      .filter(r => r.county_name?.toLowerCase().includes(q) || r.state_abbr?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, mode, stateMapData, countyMapData]);

  const handleSelect = (item) => {
    if (mode === "state") onStateSelect(item.state_abbr);
    else onCountySelect(item.fips);
    setQuery(""); setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{
        display: "flex", alignItems: "center",
        background: "var(--surface-2)", border: "1px solid var(--border)",
        borderRadius: 6, overflow: "hidden",
      }}>
        <span style={{ padding: "0 0 0 9px", color: "var(--text-muted)", display: "flex" }}><IconSearch /></span>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={mode === "state" ? "Search states…" : "Search counties…"}
          style={{ border: "none", outline: "none", background: "transparent", padding: "5px 7px", fontSize: 12, width: 130, color: "var(--text)" }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }}
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: "0 7px", color: "var(--text-muted)", fontSize: 16, lineHeight: 1 }}>×</button>
        )}
      </div>
      {open && query && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 200,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.13)", zIndex: 1000, overflow: "hidden",
        }}>
          {results.map(item => (
            <div
              key={mode === "state" ? item.state_abbr : item.fips}
              onClick={() => handleSelect(item)}
              style={{ padding: "8px 13px", cursor: "pointer", fontSize: 12.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontWeight: 500 }}>{mode === "state" ? item.state_name : item.county_name}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.state_abbr}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Empty panel placeholder
══════════════════════════════════════════════════════════════════════ */
function EmptyPanel({ title, subtitle }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      <div className="card-header" style={{ flexShrink: 0 }}>
        <div>
          <span className="card-title">{title}</span>
          {subtitle && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
        Coming soon
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Main Economic page
══════════════════════════════════════════════════════════════════════ */
export default function Economic() {
  const { selectedElectionId, loadElections } = useElectionsStore();

  const [stateMapData,      setStateMapData]      = useState(new Map());
  const [countyMapData,     setCountyMapData]     = useState(new Map());
  const [stateMapLoading,   setStateMapLoading]   = useState(false);
  const [quintileData,      setQuintileData]      = useState([]);
  const [quintileLoading,   setQuintileLoading]   = useState(false);
  const [scatterData,       setScatterData]       = useState([]);
  const [scatterLoading,    setScatterLoading]    = useState(false);
  const [affordData,        setAffordData]        = useState([]);
  const [affordLoading,     setAffordLoading]     = useState(false);
  const [segmentData,       setSegmentData]       = useState([]);
  const [segmentLoading,    setSegmentLoading]    = useState(false);
  const [incomepopData,     setIncomepopData]     = useState([]);
  const [incomepopLoading,  setIncomepopLoading]  = useState(false);
  const [inequalityData,    setInequalityData]    = useState([]);
  const [inequalityLoading, setInequalityLoading] = useState(false);
  const [inequalityOrderBy, setInequalityOrderBy] = useState("inequality_proxy");
  const [inequalityAsc,     setInequalityAsc]     = useState(false);
  const [inequalityLimit,   setInequalityLimit]   = useState(10);
  const [persuasionData,    setPersuasionData]    = useState([]);
  const [persuasionLoading, setPersuasionLoading] = useState(false);
  const [stressData,        setStressData]        = useState([]);
  const [stressLoading,     setStressLoading]     = useState(false);
  const [stressOrderBy,     setStressOrderBy]     = useState("stress_score");
  const [stressAsc,         setStressAsc]         = useState(false);
  const [stressLimit,       setStressLimit]       = useState(10);

  const [selectedStateAbbr,  setSelectedStateAbbr]  = useState(null);
  const [selectedCountyFips, setSelectedCountyFips] = useState(null);
  const [viewMode,           setViewMode]           = useState("states");

  useEffect(() => { loadElections(); }, [loadElections]);

  useEffect(() => {
    if (!selectedElectionId) return;
    setStateMapLoading(true);
    dashboardService.getStateMapData(selectedElectionId)
      .then(rows => setStateMapData(new Map(rows.map(r => [r.state_fips, r]))))
      .catch(console.error)
      .finally(() => setStateMapLoading(false));
    dashboardService.getMapData(selectedElectionId)
      .then(rows => setCountyMapData(new Map(rows.map(r => [r.fips, r]))))
      .catch(console.error);
    setSelectedStateAbbr(null);
    setSelectedCountyFips(null);
  }, [selectedElectionId]);

  useEffect(() => {
    if (!selectedElectionId) return;
    setQuintileLoading(true);
    dashboardService.getIncomeQuintiles(selectedElectionId, selectedStateAbbr)
      .then(setQuintileData)
      .catch(console.error)
      .finally(() => setQuintileLoading(false));
    setScatterLoading(true);
    dashboardService.getIncomeCompetitiveness(selectedElectionId, selectedStateAbbr)
      .then(setScatterData)
      .catch(console.error)
      .finally(() => setScatterLoading(false));
    setInequalityLoading(true);
    dashboardService.getInequalityProxy(selectedElectionId, selectedStateAbbr, 50)
      .then(setInequalityData)
      .catch(console.error)
      .finally(() => setInequalityLoading(false));
    setIncomepopLoading(true);
    dashboardService.getIncomePopulation(selectedElectionId, selectedStateAbbr)
      .then(setIncomepopData)
      .catch(console.error)
      .finally(() => setIncomepopLoading(false));
    setSegmentLoading(true);
    dashboardService.getIncomeSegments(selectedElectionId, selectedStateAbbr)
      .then(setSegmentData)
      .catch(console.error)
      .finally(() => setSegmentLoading(false));
    setAffordLoading(true);
    dashboardService.getHousingAffordability(selectedElectionId, selectedStateAbbr)
      .then(setAffordData)
      .catch(console.error)
      .finally(() => setAffordLoading(false));
    setStressLoading(true);
    dashboardService.getEconomicStress(selectedElectionId, selectedStateAbbr, 50)
      .then(setStressData)
      .catch(console.error)
      .finally(() => setStressLoading(false));
    setPersuasionLoading(true);
    dashboardService.getPersuasionSegments(selectedElectionId, selectedStateAbbr)
      .then(setPersuasionData)
      .catch(console.error)
      .finally(() => setPersuasionLoading(false));
  }, [selectedElectionId, selectedStateAbbr]);

  const handleStateSelect = useCallback((abbr) => {
    setSelectedCountyFips(null);
    if (viewMode === "drilldown") setSelectedStateAbbr(abbr);
    else setSelectedStateAbbr(p => p === abbr ? null : abbr);
  }, [viewMode]);

  const handleCountySelect = useCallback((fips) => {
    setSelectedCountyFips(p => p === fips ? null : fips);
  }, []);

  const handleViewMode = useCallback((mode) => {
    setViewMode(mode);
    setSelectedCountyFips(null);
    if (mode === "states") setSelectedStateAbbr(null);
  }, []);

  const handleSearchCounty = useCallback((fips) => {
    setViewMode("counties");
    setSelectedCountyFips(fips);
    setSelectedStateAbbr(null);
  }, []);

  const stressDisplayData = useMemo(() => {
    const dir = stressAsc ? 1 : -1;
    const sorted = [...stressData].sort((a, b) => {
      switch (stressOrderBy) {
        case "income":          return dir * (a.income - b.income);
        case "commute":         return dir * (a.commute_min - b.commute_min);
        case "homeownership":   return dir * (a.homeownership_pct - b.homeownership_pct);
        case "competitiveness": return dir * (a.competitiveness_score - b.competitiveness_score);
        default:                return dir * (a.stress_score - b.stress_score);
      }
    });
    return sorted.slice(0, stressLimit);
  }, [stressData, stressOrderBy, stressAsc, stressLimit]);

  const inequalityDisplayData = useMemo(() => {
    const dir = inequalityAsc ? 1 : -1;
    const sorted = [...inequalityData].sort((a, b) => {
      switch (inequalityOrderBy) {
        case "income":          return dir * (a.income - b.income);
        case "per_capita":      return dir * (a.per_capita - b.per_capita);
        case "competitiveness": return dir * (a.competitiveness_score - b.competitiveness_score);
        default:                return dir * (a.inequality_proxy - b.inequality_proxy);
      }
    });
    return sorted.slice(0, inequalityLimit);
  }, [inequalityData, inequalityOrderBy, inequalityAsc, inequalityLimit]);

  const selectedState  = selectedStateAbbr ? [...stateMapData.values()].find(r => r.state_abbr === selectedStateAbbr) : null;
  const selectedCounty = selectedCountyFips ? countyMapData.get(selectedCountyFips) : null;
  const selectionLabel = selectedCounty
    ? `${selectedCounty.county_name}, ${selectedCounty.state_abbr}`
    : selectedState?.state_name ?? null;

  const ViewModeBtn = ({ mode }) => (
    <button onClick={() => handleViewMode(mode)} style={{
      fontSize: 10, padding: "3px 7px", borderRadius: 5,
      border: "1px solid var(--border)",
      background: viewMode === mode ? "var(--surface-2)" : "transparent",
      fontWeight: viewMode === mode ? 600 : 400,
      cursor: "pointer", color: "var(--text)",
    }}>
      {mode.charAt(0).toUpperCase() + mode.slice(1)}
    </button>
  );

  return (
    <Layout>
      <div style={{
        height: 57, flexShrink: 0, padding: "0 24px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>ANALYTICS</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Economic Analysis</div>
        </div>
        {selectionLabel && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Filtered: <strong style={{ color: "var(--text)" }}>{selectionLabel}</strong>
            <button
              onClick={() => { setSelectedStateAbbr(null); setSelectedCountyFips(null); }}
              style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            >✕</button>
          </div>
        )}
      </div>

      <div style={{
        height: "calc(100vh - 57px)",
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr 1fr",
        gridTemplateRows: "1fr 1fr 1fr",
        gap: 10, padding: 10,
        boxSizing: "border-box",
        overflow: "hidden",
      }}>

        {/* ── Visual 1: Electoral Map ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <span className="card-title">Electoral Map</span>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <MapSearch
                viewMode={viewMode}
                stateMapData={stateMapData}
                countyMapData={countyMapData}
                onStateSelect={handleStateSelect}
                onCountySelect={handleSearchCounty}
              />
              {["states", "counties", "drilldown"].map(m => <ViewModeBtn key={m} mode={m} />)}
            </div>
          </div>
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
            {stateMapLoading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /> Loading map…</div>
              : (
                <StateMap
                  viewMode={viewMode}
                  stateResults={stateMapData}
                  countyResults={countyMapData}
                  onStateSelect={handleStateSelect}
                  onCountySelect={handleCountySelect}
                  selectedStateAbbr={selectedStateAbbr}
                  selectedCountyFips={selectedCountyFips}
                />
              )}
          </div>
        </div>

        {/* ── Visual 2: Income Quintile Vote Breakdown ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div>
              <span className="card-title">Income Quintile Vote Breakdown</span>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                Avg Trump vs Harris vote share by household income quintile
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {quintileLoading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /> Loading…</div>
              : <IncomeQuintileChart data={quintileData} />
            }
          </div>
        </div>
        {/* ── Visual 4: Economic Stress Index ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div>
              <span className="card-title">Economic Stress Index</span>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                Composite stress - income, commute, homeownership
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <select
                value={stressOrderBy}
                onChange={e => setStressOrderBy(e.target.value)}
                style={{ fontSize: 10, padding: "3px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", cursor: "pointer" }}
              >
                <option value="stress_score">Stress</option>
                <option value="income">Income</option>
                <option value="commute">Commute</option>
                <option value="homeownership">Homeown.</option>
                <option value="competitiveness">Competitive</option>
              </select>
              <button
                onClick={() => setStressAsc(p => !p)}
                title={stressAsc ? "Ascending" : "Descending"}
                style={{ fontSize: 12, padding: "2px 7px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", cursor: "pointer", lineHeight: 1.4 }}
              >
                {stressAsc ? "↑" : "↓"}
              </button>
              <select
                value={stressLimit}
                onChange={e => setStressLimit(Number(e.target.value))}
                style={{ fontSize: 10, padding: "3px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", cursor: "pointer" }}
              >
                <option value={10}>Show 10</option>
                <option value={20}>Show 20</option>
                <option value={50}>Show 50</option>
              </select>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            {stressLoading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /> Loading…</div>
              : <EconomicStressChart data={stressDisplayData} />
            }
          </div>
        </div>
        {/* ── Visual 3: Income × Competitiveness Scatter ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div>
              <span className="card-title">Income × Competitiveness</span>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                Each dot is a county - <span style={{ color: "#E5342A" }}>Trump</span> / <span style={{ color: "#3B82F6" }}>Harris</span> wins
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {scatterLoading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /> Loading…</div>
              : <IncomeCompetitivenessChart data={scatterData} />
            }
          </div>
        </div>
        {/* ── Visual 5: Income vs Housing Affordability ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ flexShrink: 0, flexWrap: "wrap", gap: 6 }}>
            <div>
              <span className="card-title">Income vs Housing Affordability</span>
              <div style={{ marginTop: 3 }}><AffordabilityLegend /></div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {affordLoading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /> Loading…</div>
              : <HousingAffordabilityChart data={affordData} />
            }
          </div>
        </div>
        {/* ── Visual 6: Income Segmentation Strategy ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div>
              <span className="card-title">Income Segmentation Strategy</span>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                County count by income tier - national 30/70 percentile cut
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {segmentLoading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /> Loading…</div>
              : <IncomeSegmentChart data={segmentData} />
            }
          </div>
        </div>
        {/* ── Visual 7: Income vs Population ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div>
              <span className="card-title">Income vs Population</span>
              <div style={{ marginTop: 3 }}><IncomePopLegend /></div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {incomepopLoading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /> Loading…</div>
              : <IncomePopulationChart data={incomepopData} />
            }
          </div>
        </div>
        {/* ── Visual 8: Income Inequality Proxy ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div>
              <span className="card-title">Income Inequality Proxy</span>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                Median income minus per capita - proxy for distribution tension
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <select
                value={inequalityOrderBy}
                onChange={e => setInequalityOrderBy(e.target.value)}
                style={{ fontSize: 10, padding: "3px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", cursor: "pointer" }}
              >
                <option value="inequality_proxy">Inequality</option>
                <option value="income">Income</option>
                <option value="per_capita">Per Capita</option>
                <option value="competitiveness">Competitive</option>
              </select>
              <button
                onClick={() => setInequalityAsc(p => !p)}
                title={inequalityAsc ? "Ascending" : "Descending"}
                style={{ fontSize: 12, padding: "2px 7px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", cursor: "pointer", lineHeight: 1.4 }}
              >
                {inequalityAsc ? "↑" : "↓"}
              </button>
              <select
                value={inequalityLimit}
                onChange={e => setInequalityLimit(Number(e.target.value))}
                style={{ fontSize: 10, padding: "3px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", cursor: "pointer" }}
              >
                <option value={10}>Show 10</option>
                <option value={20}>Show 20</option>
                <option value={50}>Show 50</option>
              </select>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            {inequalityLoading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /> Loading…</div>
              : <InequalityProxyChart data={inequalityDisplayData} />
            }
          </div>
        </div>
        {/* ── Visual 9: Income Distribution by Persuasion Segment ── */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div>
              <span className="card-title">Income by Persuasion Segment</span>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                Income distribution within education-based voter segments
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {[
                { label: "Mass", color: "#8B5CF6" },
                { label: "Informed", color: "#3B82F6" },
                { label: "Low Eng.", color: "#6B7280" },
                { label: "Niche", color: "#10B981" },
              ].map(s => (
                <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--text-muted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {persuasionLoading
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--text-muted)" }}><Spinner /> Loading…</div>
              : <PersuasionViolinChart data={persuasionData} />
            }
          </div>
        </div>
      </div>
    </Layout>
  );
}
