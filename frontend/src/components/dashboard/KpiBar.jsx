import StatCard from "../ui/StatCard";
import { fmtNum, fmtPct, fmtMargin, partyLabel, partyColor } from "../../utils/formatters";
import Spinner from "../ui/Spinner";

export default function KpiBar({ summary, loading }) {
  if (loading) {
    return (
      <div className="kpi-bar" style={{ display: "block" }}>
        <div className="kpi-card"><Spinner center={false} /></div>
      </div>
    );
  }

  if (!summary) return null;

  const rep = summary.candidates?.find((c) => c.party_code === "REP" || c.party_code === "REPUBLICAN");
  const dem = summary.candidates?.find((c) => c.party_code === "DEM" || c.party_code === "DEMOCRAT");

  const repPct  = rep ? Number(rep.vote_pct) : null;
  const demPct  = dem ? Number(dem.vote_pct) : null;
  const winner  = summary.candidates?.[0];
  const margin  = repPct != null && demPct != null ? repPct - demPct : null;

  return (
    <div className="kpi-bar">
      <StatCard
        label="Total Votes Cast"
        value={fmtNum(summary.total_votes)}
      />
      <StatCard
        label="Leading Candidate"
        value={winner ? partyLabel(winner.party_code) : "-"}
        delta={winner ? fmtPct(winner.vote_pct) : null}
        deltaPositive={null}
      />
      <StatCard
        label="Republican Vote %"
        value={fmtPct(repPct)}
        delta={null}
      />
      <StatCard
        label="Democrat Vote %"
        value={fmtPct(demPct)}
        delta={null}
      />
      <StatCard
        label="Margin"
        value={margin != null ? fmtMargin(margin) : "-"}
        delta={margin != null ? (Math.abs(margin) < 5 ? "TIGHT" : null) : null}
        deltaPositive={false}
      />
    </div>
  );
}
