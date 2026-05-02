import { useNavigate } from "react-router-dom";
import Spinner from "../ui/Spinner";
import { fmtNum, fmtPct, partyColor, partyDotClass } from "../../utils/formatters";

export default function StateSummaryTable({ rows = [], loading }) {
  const navigate = useNavigate();

  if (loading) return <Spinner />;
  if (!rows.length) return <div className="empty-state">No data available.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 28 }} />
            <th>State</th>
            <th>Region</th>
            <th>Total Votes</th>
            <th>Counties</th>
            <th>Competitive</th>
            <th>Avg Margin</th>
            <th>Called For</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.state_abbr}
              onClick={() => navigate(`/states/${row.state_abbr}`)}
            >
              <td style={{ paddingRight: 0 }}>
                <span className={`row-indicator ${partyDotClass(null)}`}
                  style={{
                    display: "block",
                    background: row.state_winner?.toLowerCase().includes("trump") ||
                                row.state_winner?.toLowerCase().includes("republican")
                      ? "#E5342A"
                      : row.state_winner?.toLowerCase().includes("biden") ||
                        row.state_winner?.toLowerCase().includes("harris") ||
                        row.state_winner?.toLowerCase().includes("democrat")
                      ? "#3B82F6"
                      : "#9CA3AF",
                  }}
                />
              </td>
              <td style={{ fontWeight: 600 }}>{row.state_abbr}</td>
              <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{row.region ?? "-"}</td>
              <td>{fmtNum(row.total_votes)}</td>
              <td style={{ color: "var(--text-muted)" }}>{fmtNum(row.county_count)}</td>
              <td>
                <span style={{ color: Number(row.competitive_counties) > 0 ? "#E5342A" : "var(--text-muted)" }}>
                  {fmtNum(row.competitive_counties)}
                </span>
              </td>
              <td style={{ fontWeight: 500 }}>{fmtPct(row.avg_margin_pct)}</td>
              <td style={{
                maxWidth: 140,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 12,
                color: "var(--text-muted)",
              }}>
                {row.state_winner ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
