export default function FilterPanel({ states = [], selectedState, onStateChange }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <label style={{ fontSize: "0.875rem", color: "#94a3b8" }}>State</label>
      <select
        value={selectedState ?? ""}
        onChange={(e) => onStateChange(e.target.value || null)}
        style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 4, padding: "0.25rem 0.5rem" }}
      >
        <option value="">All States</option>
        {states.map((s) => (
          <option key={s.state_abbr} value={s.state_abbr}>{s.state_name}</option>
        ))}
      </select>
    </div>
  );
}
