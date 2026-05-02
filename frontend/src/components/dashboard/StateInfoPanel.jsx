import { fmtNum, partyColor, partyLabel } from "../../utils/formatters";

const REP_COLOR = partyColor("REP");
const DEM_COLOR = partyColor("DEM");

function VoteBar({ repPct, demPct }) {
  return (
    <div>
      <div style={{ display: "flex", height: 22, borderRadius: 5, overflow: "hidden", gap: 2 }}>
        <div style={{ flex: repPct, background: REP_COLOR, minWidth: repPct > 0 ? 2 : 0, transition: "flex 0.4s ease" }} />
        <div style={{ flex: demPct, background: DEM_COLOR, minWidth: demPct > 0 ? 2 : 0, transition: "flex 0.4s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>
        <span style={{ color: REP_COLOR }}>{repPct.toFixed(1)}% R</span>
        <span style={{ color: DEM_COLOR }}>D {demPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

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

export default function StateInfoPanel({ state, loading }) {
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-xmuted)" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", color: "var(--text-xmuted)", fontSize: 13, textAlign: "center",
        padding: "24px 20px", gap: 10,
      }}>
        <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} opacity={0.4}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497z" />
        </svg>
        <div style={{ fontWeight: 500 }}>Click a state to view details</div>
        <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.7 }}>
          States are colored by their election winner.<br />Shade intensity reflects the margin of victory.
        </div>
      </div>
    );
  }

  const dem = Number(state.dem_votes || 0);
  const rep = Number(state.rep_votes || 0);
  const rdTotal = dem + rep;
  const demPct = rdTotal > 0 ? (dem / rdTotal) * 100 : 0;
  const repPct = rdTotal > 0 ? (rep / rdTotal) * 100 : 0;
  const winnerColor = partyColor(state.winner_party);
  const winnerLabel = partyLabel(state.winner_party);
  const votesToWin = (rep || dem) ? Math.abs(rep - dem) : null;

  return (
    <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
          Selected State
        </div>
        <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.2 }}>{state.state_name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 5,
            background: winnerColor + "18",
            color: winnerColor,
            fontSize: 12, fontWeight: 700,
            border: `1px solid ${winnerColor}40`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: winnerColor, display: "inline-block" }} />
            {winnerLabel} +{Number(state.margin_pct).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Vote share bar */}
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
          Vote Share (R vs D)
        </div>
        <VoteBar repPct={repPct} demPct={demPct} />
      </div>

      {/* Stats grid */}
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
          Summary
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <StatTile label="Total Votes"    value={fmtNum(state.total_votes)} />
          <StatTile label="Counties"       value={state.county_count ?? "-"} />
          <StatTile label="Rep Votes"      value={fmtNum(rep)} color={REP_COLOR} />
          <StatTile label="Dem Votes"      value={fmtNum(dem)} color={DEM_COLOR} />
          <StatTile label="Competitive"    value={state.competitive_counties ?? 0} />
          <StatTile label="State"          value={state.state_abbr} />
          <StatTile label="Margin" value={fmtNum(votesToWin)} />
        </div>
      </div>
    </div>
  );
}
