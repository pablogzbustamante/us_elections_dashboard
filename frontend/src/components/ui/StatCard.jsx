export default function StatCard({ label, value, delta, deltaPositive }) {
  const deltaClass =
    delta == null
      ? ""
      : deltaPositive === true
      ? "delta-up"
      : deltaPositive === false
      ? "delta-down"
      : "delta-neutral";

  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
        <span className="kpi-value">{value}</span>
        {delta != null && (
          <span className={`kpi-delta ${deltaClass}`}>{delta}</span>
        )}
      </div>
    </div>
  );
}
