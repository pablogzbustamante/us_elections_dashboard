import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useElectionsStore from "../store/useElectionsStore";
import { dashboardService } from "../services/dashboardService";
import KpiBar from "../components/dashboard/KpiBar";
import RightPanel from "../components/dashboard/RightPanel";
import StateMap from "../components/charts/StateMap";
import StateInfoPanel from "../components/dashboard/StateInfoPanel";
import CountyInfoPanel from "../components/dashboard/CountyInfoPanel";
import Layout from "../components/layout/Layout";

// Power BI-style drill mode button
function DrillBtn({ active, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`drill-btn${active ? " drill-btn-active" : ""}`}
    >
      {children}
    </button>
  );
}

// Icons
const IconState = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
);
const IconCounty = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconDrill = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>
  </svg>
);
const IconUp = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>
  </svg>
);

const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

function MapSearch({ viewMode, stateMapData, countyMapData, onStateSelect, onCountySelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const containerRef      = useRef(null);

  const mode = viewMode === "states" ? "state" : "county";

  // Reset query when view mode changes
  useEffect(() => { setQuery(""); setOpen(false); }, [viewMode]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (mode === "state") {
      return [...stateMapData.values()]
        .filter((r) => r.state_name?.toLowerCase().includes(q) || r.state_abbr?.toLowerCase().includes(q))
        .slice(0, 8);
    }
    return [...countyMapData.values()]
      .filter((r) => r.county_name?.toLowerCase().includes(q) || r.state_abbr?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, mode, stateMapData, countyMapData]);

  const handleSelect = (item) => {
    if (mode === "state") onStateSelect(item.state_abbr);
    else onCountySelect(item.fips);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <div style={{
        display: "flex", alignItems: "center",
        background: "var(--surface-2)", border: "1px solid var(--border)",
        borderRadius: 6, overflow: "hidden",
      }}>
        <span style={{ padding: "0 0 0 9px", color: "var(--text-muted)", display: "flex" }}><IconSearch /></span>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={mode === "state" ? "Search states…" : "Search counties…"}
          style={{
            border: "none", outline: "none", background: "transparent",
            padding: "6px 8px", fontSize: 12.5, width: 170, color: "var(--text)",
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: "0 8px", color: "var(--text-muted)", fontSize: 16, lineHeight: 1 }}
          >×</button>
        )}
      </div>

      {/* Dropdown */}
      {open && query && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          minWidth: 240,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.13)",
          zIndex: 1000, overflow: "hidden",
        }}>
          {countyNotLoaded ? (
            <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" }}>
              Switch to Counties view first to enable county search
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" }}>No results</div>
          ) : results.map((item) => (
            <div
              key={mode === "state" ? item.state_abbr : item.fips}
              onClick={() => handleSelect(item)}
              style={{ padding: "9px 14px", cursor: "pointer", fontSize: 12.5, display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.1s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
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

export default function Dashboard() {
  const { elections, selectedElectionId, setCounty, loadElections } = useElectionsStore();

  const [summary,           setSummary]           = useState(null);
  const [competitive,       setCompetitive]       = useState([]);
  const [stateMapData,      setStateMapData]      = useState(new Map());
  const [countyMapData,     setCountyMapData]     = useState(new Map());
  const [partyData,         setPartyData]         = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [stateMapLoading,   setStateMapLoading]   = useState(false);
  const [countyMapLoading,  setCountyMapLoading]  = useState(false);
  const [countyDataLoaded,  setCountyDataLoaded]  = useState(false);
  const [viewMode,          setViewMode]          = useState("states"); // "states" | "counties" | "drilldown"
  const [selectedStateAbbr,  setSelectedStateAbbr]  = useState(null);
  const [selectedCountyFips, setSelectedCountyFips] = useState(null);
  const [selectedFips,       setSelectedFips]       = useState(null);

  useEffect(() => { loadElections(); }, [loadElections]);

  // Main data load on election change
  useEffect(() => {
    if (!selectedElectionId) return;
    setLoading(true);
    Promise.all([
      dashboardService.getSummary(selectedElectionId),
      dashboardService.getCompetitive(selectedElectionId, 50),
      dashboardService.getPartyComparison(selectedElectionId),
    ])
      .then(([sum, comp, party]) => {
        setSummary(sum);
        setCompetitive(comp);
        setPartyData(party);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedElectionId]);

  // Load state map data eagerly on election change
  useEffect(() => {
    if (!selectedElectionId) return;
    setStateMapLoading(true);
    dashboardService.getStateMapData(selectedElectionId)
      .then((rows) => {
        const m = new Map(rows.map((r) => [r.state_fips, r]));
        setStateMapData(m);
        setSelectedStateAbbr(null);
      })
      .catch(console.error)
      .finally(() => setStateMapLoading(false));
  }, [selectedElectionId]);

  // Reset county cache when election changes
  useEffect(() => {
    setCountyDataLoaded(false);
    setCountyMapData(new Map());
  }, [selectedElectionId]);

  // Load county data lazily when Counties or Drill Down mode is first used
  useEffect(() => {
    if (viewMode === "states" || countyDataLoaded || !selectedElectionId) return;
    setCountyMapLoading(true);
    dashboardService.getMapData(selectedElectionId)
      .then((rows) => {
        const m = new Map(rows.map((r) => [r.fips, r]));
        setCountyMapData(m);
        setCountyDataLoaded(true);
      })
      .catch(console.error)
      .finally(() => setCountyMapLoading(false));
  }, [viewMode, selectedElectionId, countyDataLoaded]);

  // When switching to States mode, clear drill-down zoom but keep selection for info panel
  const handleSetViewMode = useCallback((mode) => {
    setViewMode(mode);
    setSelectedCountyFips(null);
    if (mode === "states") setSelectedStateAbbr(null);
  }, []);

  const handleStateSelect = useCallback((stateAbbr) => {
    setSelectedCountyFips(null);
    if (viewMode === "drilldown") {
      setSelectedStateAbbr(stateAbbr);
    } else {
      setSelectedStateAbbr((prev) => prev === stateAbbr ? null : stateAbbr);
    }
  }, [viewMode]);

  const handleCountyClick = useCallback((fips) => {
    setSelectedCountyFips((prev) => prev === fips ? null : fips);
  }, []);

  const handleCountySelect = useCallback((fips) => {
    setSelectedFips(fips);
    setCounty(fips);
  }, [setCounty]);

  const handleSearchCountySelect = useCallback((fips) => {
    setViewMode("counties");
    setSelectedCountyFips(fips);
    setSelectedStateAbbr(null);
  }, []);

  const selectedElection    = elections.find((e) => e.election_id === selectedElectionId);
  const selectedStateRecord = selectedStateAbbr
    ? [...stateMapData.values()].find((r) => r.state_abbr === selectedStateAbbr)
    : null;
  const selectedCountyData  = selectedCountyFips ? countyMapData.get(selectedCountyFips) : null;

  const isDrilledIn      = viewMode === "drilldown" && !!selectedStateAbbr;
  const showCountyPanel  = (viewMode === "counties" || isDrilledIn) && !!selectedCountyFips;

  const rightPanelContent = (
    <RightPanel
      partyData={partyData}
      topCounties={competitive}
      loading={loading}
    />
  );

  return (
    <Layout rightPanel={rightPanelContent}>
      {/* Page header */}
      <div style={{ padding: "20px 24px 8px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 2 }}>REALTIME OVERVIEW</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {selectedElection ? `${selectedElection.election_year} ${selectedElection.office}` : "US Elections Dashboard"}
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* KPI Bar */}
        <KpiBar summary={summary} loading={loading} />

        {/* ── Hero Map Section ── */}
        <div className="card map-hero-card">
          <div className="map-hero-header">
            {/* Left: title + breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div className="card-title" style={{ fontSize: 12 }}>
                  {isDrilledIn ? `${selectedStateRecord?.state_name ?? selectedStateAbbr} - Counties` : "United States Electoral Map"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  {selectedElection?.election_year ?? ""} Presidential Election
                  {viewMode === "states"    && " · State results · click to select"}
                  {viewMode === "counties"  && " · County results · click to select state"}
                  {viewMode === "drilldown" && !isDrilledIn && " · Drill down mode · click a state to zoom in"}
                  {isDrilledIn && " · click Back to return to full view"}
                </div>
              </div>

              {/* Breadcrumb when drilled in */}
              {isDrilledIn && (
                <div className="drill-breadcrumb">
                  <button className="drill-back-btn" onClick={() => setSelectedStateAbbr(null)}>
                    <IconUp /> Back
                  </button>
                  <span className="drill-crumb-sep">›</span>
                  <span className="drill-crumb">United States</span>
                  <span className="drill-crumb-sep">›</span>
                  <span className="drill-crumb drill-crumb-active">{selectedStateRecord?.state_name ?? selectedStateAbbr}</span>
                </div>
              )}
            </div>

            {/* Search */}
            <MapSearch
              stateMapData={stateMapData}
              countyMapData={countyMapData}
              onStateSelect={handleStateSelect}
              onCountySelect={handleSearchCountySelect}
            />

            {/* Right: drill mode controls */}
            <div className="drill-controls">
              <DrillBtn
                active={viewMode === "states"}
                onClick={() => handleSetViewMode("states")}
                title="View by state - states colored by their election winner"
              >
                <IconState /> States
              </DrillBtn>
              <DrillBtn
                active={viewMode === "counties"}
                onClick={() => handleSetViewMode("counties")}
                title="View by county - each county colored by its own winner"
              >
                <IconCounty /> Counties
                {viewMode === "counties" && countyMapLoading && (
                  <span style={{ marginLeft: 4 }}><div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /></span>
                )}
              </DrillBtn>
              <DrillBtn
                active={viewMode === "drilldown"}
                onClick={() => handleSetViewMode("drilldown")}
                title="Drill down - click a state to zoom into its counties"
              >
                <IconDrill /> Drill Down
                {viewMode === "drilldown" && countyMapLoading && (
                  <span style={{ marginLeft: 4 }}><div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /></span>
                )}
              </DrillBtn>
            </div>
          </div>

          <div className="map-hero-body">
            {/* Map */}
            <div className="map-hero-map">
              {stateMapLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", gap: 10 }}>
                  <div className="spinner" /> Loading map…
                </div>
              ) : (
                <StateMap
                  viewMode={viewMode}
                  stateResults={stateMapData}
                  countyResults={countyMapData}
                  onStateSelect={handleStateSelect}
                  onCountySelect={handleCountyClick}
                  selectedStateAbbr={selectedStateAbbr}
                  selectedCountyFips={selectedCountyFips}
                />
              )}
            </div>

            {/* State / County info panel */}
            <div className="map-hero-panel">
              {showCountyPanel
                ? <CountyInfoPanel county={selectedCountyData} loading={countyMapLoading} />
                : <StateInfoPanel state={selectedStateRecord} loading={stateMapLoading} />
              }
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
