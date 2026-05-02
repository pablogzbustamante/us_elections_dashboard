import { useNavigate } from "react-router-dom";
import Badge from "../ui/Badge";
import Spinner from "../ui/Spinner";
import { fmtNum, fmtPct, fmtMargin, competitivenessLabel, partyDotClass } from "../../utils/formatters";

export default function CountyResultsTable({ rows = [], loading }) {
  const navigate = useNavigate();

  if (loading) return <Spinner />;
  if (!rows.length) return <div className="empty-state">No data available.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 28 }} />
            <th>County</th>
            <th>State</th>
            <th>Total Votes</th>
            <th>Winner</th>
            <th>Margin</th>
            <th>Competition</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { label, cls } = competitivenessLabel(row.competitiveness_score);
            return (
              <tr key={row.fips} onClick={() => navigate(`/county/${row.fips}`)}>
                <td style={{ paddingRight: 0 }}>
                  <span
                    className={`row-indicator ${partyDotClass(row.winner_party)}`}
                    style={{ display: "block" }}
                  />
                </td>
                <td style={{ fontWeight: 500 }}>{row.county_name}</td>
                <td style={{ color: "var(--text-muted)" }}>{row.state_abbr}</td>
                <td>{fmtNum(row.total_votes)}</td>
                <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.winner_name_raw ?? "-"}
                </td>
                <td style={{ fontWeight: 600 }}>
                  {fmtMargin(row.margin_pct)}
                </td>
                <td>
                  <Badge variant={cls.replace("badge-", "")}>{label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
