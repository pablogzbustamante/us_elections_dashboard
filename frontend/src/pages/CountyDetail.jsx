import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import VoteBarChart from "../components/charts/VoteBarChart";
import DemographicsChart from "../components/charts/DemographicsChart";
import Spinner from "../components/ui/Spinner";
import Badge from "../components/ui/Badge";
import Tabs from "../components/ui/Tabs";
import { countyService } from "../services/countyService";
import { electionService } from "../services/electionService";
import { analyticsService } from "../services/analyticsService";
import useElectionsStore from "../store/useElectionsStore";
import { fmtNum, fmtPct, fmtMargin, partyColor, partyLabel, competitivenessLabel } from "../utils/formatters";

const TABS = [
  { key: "votes",       label: "Vote Results" },
  { key: "history",     label: "Winner History" },
  { key: "demographics",label: "Demographics" },
  { key: "education",   label: "Education" },
  { key: "religion",    label: "Religion" },
];

export default function CountyDetail() {
  const { fips } = useParams();
  const navigate = useNavigate();
  const { selectedElectionId, elections, loadElections } = useElectionsStore();

  const [county,       setCounty]       = useState(null);
  const [countyResult, setCountyResult] = useState(null);
  const [history,      setHistory]      = useState([]);
  const [demographics, setDemographics] = useState([]);
  const [education,    setEducation]    = useState([]);
  const [religion,     setReligion]     = useState([]);
  const [activeTab,    setActiveTab]    = useState("votes");
  const [loading,      setLoading]      = useState(true);

  useEffect(() => { loadElections(); }, [loadElections]);

  useEffect(() => {
    if (!fips) return;
    setLoading(true);
    Promise.all([
      countyService.getByFips(fips),
      countyService.getWinnerHistory(fips),
      analyticsService.getDemographics(fips),
      analyticsService.getEducation(fips, "2015-19"),
      analyticsService.getReligion(fips),
    ])
      .then(([c, hist, demo, edu, rel]) => {
        setCounty(c);
        setHistory(hist);
        setDemographics(demo);
        setEducation(edu);
        setReligion(rel);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fips]);

  useEffect(() => {
    if (!fips || !selectedElectionId) return;
    electionService.getCountyResult(selectedElectionId, fips)
      .then(setCountyResult)
      .catch(() => setCountyResult(null));
  }, [fips, selectedElectionId]);

  if (loading) return (
    <Layout>
      <div className="page-content"><Spinner /></div>
    </Layout>
  );

  if (!county) return (
    <Layout>
      <div className="page-content">
        <div className="empty-state">County not found.</div>
      </div>
    </Layout>
  );

  const summary = countyResult?.summary;
  const { label: compLabel, cls: compCls } = competitivenessLabel(summary?.competitiveness_score);

  // Build radar chart data from top demographics
  const radarData = demographics
    .filter((d) => d.category === "Ethnicity" || d.category === "Age")
    .slice(0, 8)
    .map((d) => ({ metric: d.indicator_name?.replace(/%\s*/g, "").slice(0, 20), value: Number(d.metric_value) ?? 0 }));

  const rightPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* County info card */}
      <div className="rp-card">
        <div className="rp-card-header">
          <span className="rp-card-title">{county.county_name}</span>
          <span className="rp-card-meta">{county.state_abbr}</span>
        </div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">State</span>
          <span className="rp-stat-value">{county.state_name}</span>
        </div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">Region</span>
          <span className="rp-stat-value">{county.region ?? "-"}</span>
        </div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">Type</span>
          <span className="rp-stat-value">{county.county_type ?? "-"}</span>
        </div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">FIPS</span>
          <span className="rp-stat-value" style={{ fontFamily: "monospace", fontSize: 12 }}>{fips}</span>
        </div>
      </div>

      {/* Election summary */}
      {summary && (
        <div className="rp-card">
          <div className="rp-card-header">
            <span className="rp-card-title">Election Result</span>
            <Badge variant={compCls.replace("badge-", "")}>{compLabel}</Badge>
          </div>
          <div className="rp-big-stat">
            <div className="rp-big-value">{fmtNum(summary.total_votes)}</div>
            <div className="rp-big-sub">Total votes cast</div>
          </div>
          <div className="rp-stat-row">
            <span className="rp-stat-label">Winner</span>
            <span className="rp-stat-value" style={{ fontSize: 12 }}>{summary.winner_name_raw ?? "-"}</span>
          </div>
          <div className="rp-stat-row">
            <span className="rp-stat-label">Margin</span>
            <span className="rp-stat-value">{fmtMargin(summary.margin_pct)}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Layout rightPanel={rightPanel}>
      <div style={{ padding: "20px 24px 8px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
        <button
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20, padding: "0 4px" }}
          onClick={() => navigate(-1)}
        >←</button>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 2 }}>COUNTY DETAIL</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{county.county_name}, {county.state_abbr}</div>
        </div>
      </div>

      <div className="page-content">
        <div className="card" style={{ overflow: "hidden" }}>
          <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

          <div style={{ minHeight: 300 }}>
            {activeTab === "votes" && (
              <div className="card-body">
                {countyResult?.candidates?.length
                  ? <VoteBarChart data={countyResult.candidates} />
                  : <div className="empty-state">No vote data for this county/election.</div>}
              </div>
            )}

            {activeTab === "history" && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Winner</th>
                      <th>Party</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.election_year}>
                        <td style={{ fontWeight: 600 }}>{h.election_year}</td>
                        <td>{h.winner_name_raw ?? "-"}</td>
                        <td>
                          {h.party_code && (
                            <span style={{ color: partyColor(h.party_code), fontWeight: 600, fontSize: 12 }}>
                              {partyLabel(h.party_code)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!history.length && (
                      <tr><td colSpan={3} className="empty-state">No history data.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "demographics" && (
              <div className="card-body">
                {radarData.length ? <DemographicsChart data={radarData} /> : <div className="empty-state">No demographics data.</div>}
                <div style={{ marginTop: 16, overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Indicator</th>
                        <th>Period</th>
                        <th>Value</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demographics.slice(0, 30).map((d, i) => (
                        <tr key={i}>
                          <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{d.category}</td>
                          <td style={{ fontWeight: 500 }}>{d.indicator_name}</td>
                          <td style={{ color: "var(--text-muted)" }}>{d.period_label}</td>
                          <td style={{ fontWeight: 600 }}>{Number(d.metric_value).toFixed(2)}</td>
                          <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{d.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "education" && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Education Level</th>
                      <th>Adults Count</th>
                      <th>Adults %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {education.map((e, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--text-muted)" }}>{e.period_label}</td>
                        <td style={{ fontWeight: 500 }}>{e.education_level_name}</td>
                        <td>{fmtNum(e.adults_count)}</td>
                        <td style={{ fontWeight: 600 }}>{fmtPct(e.adults_pct)}</td>
                      </tr>
                    ))}
                    {!education.length && (
                      <tr><td colSpan={4} className="empty-state">No education data.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "religion" && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Tradition</th>
                      <th>Adherents</th>
                      <th>Congregations</th>
                      <th>% of Pop.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {religion.slice(0, 20).map((r) => (
                      <tr key={r.group_code}>
                        <td style={{ fontWeight: 500 }}>{r.group_name}</td>
                        <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{r.tradition ?? "-"}</td>
                        <td>{fmtNum(r.adherents)}</td>
                        <td>{fmtNum(r.congregations)}</td>
                        <td style={{ fontWeight: 600 }}>{fmtPct(r.pct_total_population)}</td>
                      </tr>
                    ))}
                    {!religion.length && (
                      <tr><td colSpan={5} className="empty-state">No religion data.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
