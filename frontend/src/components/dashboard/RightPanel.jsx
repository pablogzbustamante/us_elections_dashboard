import { useNavigate } from "react-router-dom";
import Spinner from "../ui/Spinner";
import { fmtNum, fmtPct, partyColor, partyLabel, competitivenessLabel } from "../../utils/formatters";

function PartyComparisonCard({ data = [], loading }) {
  if (loading) return <div className="rp-card"><Spinner /></div>;

  const rep = data.find((d) => d.party_code === "REP" || d.party_code === "REPUBLICAN");
  const dem = data.find((d) => d.party_code === "DEM" || d.party_code === "DEMOCRAT");
  const total = (Number(rep?.counties_won ?? 0) + Number(dem?.counties_won ?? 0)) || 1;
  const repPct = rep ? (Number(rep.counties_won) / total) * 100 : 0;

  return (
    <div className="rp-card">
      <div className="rp-card-header">
        <span className="rp-card-title">Party Comparison</span>
        <span className="rp-card-meta">Counties won</span>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
          <div style={{ width: `${repPct}%`, background: "#E5342A", transition: "width .4s" }} />
          <div style={{ flex: 1, background: "#3B82F6" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
          <span style={{ color: "#E5342A", fontWeight: 600 }}>{fmtNum(rep?.counties_won)}</span>
          <span style={{ color: "#3B82F6", fontWeight: 600 }}>{fmtNum(dem?.counties_won)}</span>
        </div>
      </div>

      {[rep, dem].filter(Boolean).map((d) => (
        <div key={d.party_code} className="rp-stat-row">
          <span className="rp-stat-label" style={{ color: partyColor(d.party_code), fontWeight: 500 }}>
            {partyLabel(d.party_code)}
          </span>
          <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>Avg margin</span>
            <span className="rp-stat-value">{fmtPct(d.avg_margin_pct)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopCountiesCard({ counties = [], loading }) {
  const navigate = useNavigate();
  if (loading) return <div className="rp-card"><Spinner /></div>;

  return (
    <div className="rp-card">
      <div className="rp-card-header">
        <span className="rp-card-title">Most Competitive</span>
        <span className="rp-card-meta">Top 10 counties</span>
      </div>

      {counties.slice(0, 10).map((c, i) => {
        const { label, cls } = competitivenessLabel(c.competitiveness_score);
        return (
          <div
            key={c.fips}
            className="rp-list-item"
            onClick={() => navigate(`/county/${c.fips}`)}
          >
            <span className="rp-rank">{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.county_name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.state_abbr}</div>
            </div>
            <span className={`badge ${cls}`} style={{ fontSize: 10 }}>{label}</span>
          </div>
        );
      })}

      {!counties.length && <div className="empty-state">No data</div>}
    </div>
  );
}

export default function RightPanel({ partyData, topCounties, loading }) {
  return (
    <>
      <PartyComparisonCard data={partyData} loading={loading} />
      <TopCountiesCard counties={topCounties} loading={loading} />
    </>
  );
}
