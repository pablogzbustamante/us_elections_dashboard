import { useNavigate } from "react-router-dom";
import { fmtNum, partyColor, partyLabel, competitivenessLabel } from "../../utils/formatters";

const REP_COLOR = partyColor("REP");
const DEM_COLOR = partyColor("DEM");

function StatTile({ label, value, color }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2,
      padding: "10px 12px",
      background: "var(--surface-2)",
      borderRadius: 8,
      border: "1px solid var(--border-light)",
    }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

export default function CountyInfoPanel({ county, loading }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-xmuted)" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!county) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", color: "var(--text-xmuted)", fontSize: 13, textAlign: "center",
        padding: "24px 20px", gap: 10,
      }}>
        <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} opacity={0.4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
        </svg>
        <div style={{ fontWeight: 500 }}>Click a county to view details</div>
        <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.7 }}>
          Counties are colored by their election winner.<br />Shade intensity reflects the margin of victory.
        </div>
      </div>
    );
  }

  const winnerColor = partyColor(county.winner_party);
  const winnerLabel = partyLabel(county.winner_party);
  const { label: compLabel, cls: compCls } = competitivenessLabel(county.competitiveness_score);

  const margin = Number(county.margin_pct || 0);
  const absMargin = Math.abs(margin);

  return (
    <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 18, height: "100%", overflowY: "auto" }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
          Selected County
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{county.county_name}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>{county.state_abbr}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 5,
            background: winnerColor + "18",
            color: winnerColor,
            fontSize: 12, fontWeight: 700,
            border: `1px solid ${winnerColor}40`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: winnerColor, display: "inline-block" }} />
            {winnerLabel} +{absMargin.toFixed(1)}%
          </span>
          <span className={`badge ${compCls}`}>{compLabel}</span>
        </div>
      </div>

      {/* Margin bar */}
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
          Margin
        </div>
        <div style={{ position: "relative", height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            position: "absolute",
            top: 0, bottom: 0,
            width: `${Math.min(absMargin / 60 * 100, 100)}%`,
            background: winnerColor,
            borderRadius: 4,
          }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          +{absMargin.toFixed(1)}% {winnerLabel} margin
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
          Summary
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <StatTile label="Total Votes"  value={fmtNum(county.total_votes)} />
          <StatTile label="Winner"       value={county.winner_name_raw ?? "-"} color={winnerColor} />
          <StatTile label="Margin"       value={`+${absMargin.toFixed(1)}%`} color={winnerColor} />
          <StatTile label="County"       value={county.state_abbr} />
          <StatTile label="Winner 2020"  value={county.winner_2020 ?? "-"} />
          <StatTile label="Winner 2016"  value={county.winner_2016 ?? "-"} />
        </div>
      </div>

      {/* Link to county detail */}
      <button
        onClick={() => navigate(`/county/${county.fips}`)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "9px 14px", borderRadius: 8,
          border: "1px solid var(--border)", background: "var(--surface)",
          fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
          cursor: "pointer", transition: "background var(--transition), color var(--transition)",
          marginTop: "auto",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-muted)"; }}
      >
        View Full County Detail →
      </button>
    </div>
  );
}
