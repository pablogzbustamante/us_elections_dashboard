import { useMemo } from "react";
import TrendLineChart from "../charts/TrendLineChart";
import Spinner from "../ui/Spinner";

export default function TrendsPanel({ trends, loading }) {
  // pivot from [{election_year, party_code, avg_vote_pct}, ...] to [{year, REPUBLICAN, DEMOCRAT}, ...]
  const chartData = useMemo(() => {
    const byYear = {};
    (trends ?? []).forEach((row) => {
      const yr = row.election_year;
      if (!byYear[yr]) byYear[yr] = { year: yr };
      byYear[yr][row.party_code] = Number(row.avg_vote_pct) * 100;
    });
    return Object.values(byYear).sort((a, b) => a.year - b.year);
  }, [trends]);

  const repDelta = useMemo(() => {
    if (chartData.length < 2) return null;
    const last = chartData[chartData.length - 1];
    const prev = chartData[chartData.length - 2];
    if (!last.REPUBLICAN || !prev.REPUBLICAN) return null;
    return (last.REPUBLICAN - prev.REPUBLICAN).toFixed(1);
  }, [chartData]);

  const demDelta = useMemo(() => {
    if (chartData.length < 2) return null;
    const last = chartData[chartData.length - 1];
    const prev = chartData[chartData.length - 2];
    if (!last.DEMOCRAT || !prev.DEMOCRAT) return null;
    return (last.DEMOCRAT - prev.DEMOCRAT).toFixed(1);
  }, [chartData]);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Trends</span>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
          {repDelta != null && (
            <span style={{ color: "#E5342A", fontWeight: 600 }}>
              REP {repDelta > 0 ? "+" : ""}{repDelta}pp
            </span>
          )}
          {demDelta != null && (
            <span style={{ color: "#3B82F6", fontWeight: 600 }}>
              DEM {demDelta > 0 ? "+" : ""}{demDelta}pp
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: "8px 20px 0", display: "flex", gap: 16 }}>
        {["REPUBLICAN", "DEMOCRAT"].map((p) => (
          <span key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
            <span style={{
              width: 24, height: 2,
              background: p === "REPUBLICAN" ? "#E5342A" : "#3B82F6",
              display: "inline-block", borderRadius: 1,
            }} />
            {p === "REPUBLICAN" ? "Republican" : "Democrat"} avg vote %
          </span>
        ))}
      </div>

      <div className="chart-wrap">
        {loading ? <Spinner /> : <TrendLineChart data={chartData} />}
      </div>
    </div>
  );
}
