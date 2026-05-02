import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import ElectionMap from "../components/charts/ElectionMap";
import CountyResultsTable from "../components/dashboard/CountyResultsTable";
import Tabs from "../components/ui/Tabs";
import Spinner from "../components/ui/Spinner";
import { electionService } from "../services/electionService";
import { countyService } from "../services/countyService";
import { dashboardService } from "../services/dashboardService";
import useElectionsStore from "../store/useElectionsStore";
import { fmtNum, fmtPct, partyColor, partyLabel } from "../utils/formatters";

const TABS = [
  { key: "table", label: "County Results" },
  { key: "map",   label: "Map View" },
];

export default function ElectionResults() {
  const { electionId } = useParams();
  const numId = Number(electionId);
  const navigate = useNavigate();

  const { elections, loadElections, setElection } = useElectionsStore();
  useEffect(() => { loadElections(); setElection(numId); }, [numId]);

  const [results,   setResults]   = useState([]);
  const [mapData,   setMapData]   = useState(new Map());
  const [summary,   setSummary]   = useState(null);
  const [states,    setStates]    = useState([]);
  const [selState,  setSelState]  = useState(null);
  const [selFips,   setSelFips]   = useState(null);
  const [activeTab, setActiveTab] = useState("table");
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    countyService.getStates().then(setStates).catch(console.error);
  }, []);

  useEffect(() => {
    if (!numId) return;
    setLoading(true);
    Promise.all([
      electionService.getResults(numId, selState),
      dashboardService.getSummary(numId),
      dashboardService.getMapData(numId),
    ])
      .then(([res, sum, mapRows]) => {
        setResults(res);
        setSummary(sum);
        const m = new Map(mapRows.map((r) => [r.fips, r]));
        setMapData(m);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [numId, selState]);

  const election = elections.find((e) => e.election_id === numId);

  const tableRows = useMemo(() =>
    results.map((r) => ({
      ...r,
      winner_party: mapData.get(r.fips)?.winner_party ?? null,
    })),
    [results, mapData]
  );

  const rightPanel = summary ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="rp-card">
        <div className="rp-card-header">
          <span className="rp-card-title">National Totals</span>
        </div>
        {summary.candidates?.map((c) => (
          <div key={c.party_code} className="rp-stat-row">
            <span className="rp-stat-label" style={{ color: partyColor(c.party_code), fontWeight: 500 }}>
              {partyLabel(c.party_code)}
            </span>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {fmtNum(c.national_votes)}
              </span>
              <span className="rp-stat-value">{fmtPct(c.vote_pct)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rp-card">
        <div className="rp-card-header">
          <span className="rp-card-title">Overview</span>
        </div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">Total votes</span>
          <span className="rp-stat-value">{fmtNum(summary.total_votes)}</span>
        </div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">Total counties</span>
          <span className="rp-stat-value">{fmtNum(summary.total_counties)}</span>
        </div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">Competitive counties</span>
          <span className="rp-stat-value" style={{ color: "var(--accent)" }}>
            {fmtNum(summary.competitive_counties)}
          </span>
        </div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">Avg abs. margin</span>
          <span className="rp-stat-value">{fmtPct(summary.avg_abs_margin_pct)}</span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <Layout rightPanel={rightPanel}>
      <div style={{ padding: "20px 24px 8px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 2 }}>ELECTIONS</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {election ? `${election.election_year} ${election.office}` : `Election #${numId}`}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select
            className="election-select"
            value={selState ?? ""}
            onChange={(e) => setSelState(e.target.value || null)}
          >
            <option value="">All States</option>
            {states.map((s) => (
              <option key={s.state_abbr} value={s.state_abbr}>{s.state_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="page-content">
        <div className="card" style={{ overflow: "hidden" }}>
          <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

          {activeTab === "table" && (
            loading
              ? <Spinner />
              : <CountyResultsTable rows={tableRows} loading={false} />
          )}

          {activeTab === "map" && (
            loading
              ? <Spinner />
              : (
                <ElectionMap
                  results={mapData}
                  onSelect={(fips) => { setSelFips(fips); navigate(`/county/${fips}`); }}
                  selectedFips={selFips}
                />
              )
          )}
        </div>
      </div>
    </Layout>
  );
}
