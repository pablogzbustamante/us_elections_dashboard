export const fmtPct = (v, decimals = 1) =>
  v != null ? `${Number(v).toFixed(decimals)}%` : "-";

export const fmtNum = (v) => (v != null ? Number(v).toLocaleString() : "-");

export const fmtMargin = (v) => {
  if (v == null) return "-";
  const n = Number(v);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
};

// Handles both short codes (REP/DEM) and full codes (REPUBLICAN/DEMOCRAT)
export const partyColor = (code) => {
  if (!code) return "#9CA3AF";
  const c = code.toUpperCase();
  if (c === "REPUBLICAN" || c === "REP") return "#E5342A";
  if (c === "DEMOCRAT"   || c === "DEM") return "#3B82F6";
  if (c === "GREEN"      || c === "GRN") return "#22C55E";
  if (c === "LIBERTARIAN"|| c === "LIB") return "#F59E0B";
  return "#9CA3AF";
};

export const partyLabel = (code) => {
  if (!code) return "Unknown";
  const c = code.toUpperCase();
  if (c === "REPUBLICAN" || c === "REP") return "Republican";
  if (c === "DEMOCRAT"   || c === "DEM") return "Democrat";
  if (c === "GREEN"      || c === "GRN") return "Green";
  if (c === "LIBERTARIAN"|| c === "LIB") return "Libertarian";
  return code;
};

export const competitivenessLabel = (score) => {
  if (score == null) return { label: "Unknown", cls: "badge-neutral" };
  const s = Number(score);
  if (s >= 0.85) return { label: "Toss-Up",     cls: "badge-danger" };
  if (s >= 0.65) return { label: "Competitive",  cls: "badge-warning" };
  if (s >= 0.40) return { label: "Likely",       cls: "badge-blue" };
  return              { label: "Safe",            cls: "badge-neutral" };
};

export const partyDotClass = (code) => {
  if (!code) return "party-dot-neutral";
  const c = code.toUpperCase();
  if (c === "REPUBLICAN" || c === "REP") return "party-dot-rep";
  if (c === "DEMOCRAT"   || c === "DEM") return "party-dot-dem";
  return "party-dot-neutral";
};
