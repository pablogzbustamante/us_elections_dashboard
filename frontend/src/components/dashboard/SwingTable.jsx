import { useNavigate } from "react-router-dom";
import Badge from "../ui/Badge";
import Spinner from "../ui/Spinner";
import { fmtPct, partyLabel, partyColor } from "../../utils/formatters";

const PartyTag = ({ code }) => (
  <span style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    color: partyColor(code),
  }}>
    <span style={{ width: 8, height: 8, borderRadius: "50%", background: partyColor(code), display: "inline-block" }} />
    {partyLabel(code)}
  </span>
);

export default function SwingTable({ rows = [], loading }) {
  const navigate = useNavigate();

  if (loading) return <Spinner />;
  if (!rows.length) return <div className="empty-state">No swing data available for the selected elections.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>County</th>
            <th>State</th>
            <th>Previous Winner</th>
            <th>Current Winner</th>
            <th>Flipped</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const flippedToRep = row.party_b === "REPUBLICAN";
            return (
              <tr key={row.fips} onClick={() => navigate(`/county/${row.fips}`)}>
                <td style={{ fontWeight: 500 }}>{row.county_name}</td>
                <td style={{ color: "var(--text-muted)" }}>{row.state_abbr}</td>
                <td><PartyTag code={row.party_a} /></td>
                <td><PartyTag code={row.party_b} /></td>
                <td>
                  <Badge variant={flippedToRep ? "danger" : "blue"}>
                    → {partyLabel(row.party_b)}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
