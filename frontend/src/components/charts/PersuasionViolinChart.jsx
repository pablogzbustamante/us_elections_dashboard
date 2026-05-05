import { useState, useEffect, useRef, useMemo } from "react";

const SEGMENTS = [
  { key: "Mass Persuasion",     color: "#8B5CF6" },
  { key: "Informed Electorate", color: "#3B82F6" },
  { key: "Low Engagement",      color: "#6B7280" },
  { key: "Niche Educated",      color: "#10B981" },
];

const MARGIN = { top: 15, right: 18, bottom: 52, left: 60 };
const KDE_N  = 80;

function silvermanBw(vals) {
  const n = vals.length;
  if (n < 2) return 1;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const std  = Math.sqrt(vals.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
  return 1.06 * std * Math.pow(n, -0.2);
}

function computeKDE(vals, h, pts) {
  const k = 1 / (vals.length * h * Math.sqrt(2 * Math.PI));
  return pts.map(x => ({
    y: x,
    d: k * vals.reduce((s, xi) => s + Math.exp(-0.5 * ((x - xi) / h) ** 2), 0),
  }));
}

function quantile(sorted, p) {
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(p * sorted.length)))];
}

function fmtK(n) {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

export default function PersuasionViolinChart({ data = [] }) {
  const containerRef = useRef(null);
  const [w, setW]    = useState(500);
  const [h, setH]    = useState(260);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect;
      setW(width);
      setH(height);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const allInc = useMemo(() => data.map(d => d.income).filter(Boolean), [data]);

  const { yMin, yMax } = useMemo(() => {
    if (!allInc.length) return { yMin: 20000, yMax: 150000 };
    const lo = Math.floor(Math.min(...allInc) / 5000) * 5000;
    const hi = Math.ceil(Math.max(...allInc)  / 5000) * 5000;
    return { yMin: lo, yMax: hi };
  }, [allInc]);

  const grouped = useMemo(() => {
    const m = Object.fromEntries(SEGMENTS.map(s => [s.key, []]));
    data.forEach(d => { if (m[d.segment] && d.income > 0) m[d.segment].push(d); });
    return m;
  }, [data]);

  const innerW  = w - MARGIN.left - MARGIN.right;
  const innerH  = h - MARGIN.top - MARGIN.bottom;
  const ys      = v => MARGIN.top + innerH * (1 - (v - yMin) / (yMax - yMin));
  const xStep   = innerW / SEGMENTS.length;
  const halfVW  = Math.min(xStep * 0.40, 48);

  const evalPts = useMemo(
    () => Array.from({ length: KDE_N }, (_, i) => yMin + (yMax - yMin) * i / (KDE_N - 1)),
    [yMin, yMax],
  );

  const violins = useMemo(() => SEGMENTS.map((seg, si) => {
    const rows  = grouped[seg.key];
    const vals  = rows.map(d => d.income);
    const xc    = xStep * si + xStep / 2;
    if (vals.length < 5) return { seg, xc, kd: [], stats: null };
    const h      = silvermanBw(vals);
    const kd     = computeKDE(vals, h, evalPts);
    const sorted = [...vals].sort((a, b) => a - b);
    const trumpN = rows.filter(d => d.winner_name_raw?.toLowerCase().includes("trump")).length;
    return {
      seg, xc, kd,
      stats: {
        q1: quantile(sorted, 0.25),
        median: quantile(sorted, 0.5),
        q3: quantile(sorted, 0.75),
        n: vals.length,
        trumpN,
      },
    };
  }), [grouped, xStep, evalPts]);

  const maxD = useMemo(
    () => Math.max(...violins.map(v => v.kd.length ? Math.max(...v.kd.map(k => k.d)) : 0), 1e-10),
    [violins],
  );

  const buildPath = (kd, xc) => {
    const pts   = kd.map(p => ({ cy: ys(p.y), cx: (p.d / maxD) * halfVW }));
    const right = pts.map((p, i) => `${i === 0 ? "M" : "L"}${(xc + p.cx).toFixed(1)},${p.cy.toFixed(1)}`).join(" ");
    const left  = [...pts].reverse().map(p => `L${(xc - p.cx).toFixed(1)},${p.cy.toFixed(1)}`).join(" ");
    return `${right} ${left} Z`;
  };

  const yTickStep = Math.ceil((yMax - yMin) / 5 / 10000) * 10000 || 10000;
  const yTicks    = [];
  for (let v = Math.ceil(yMin / yTickStep) * yTickStep; v <= yMax; v += yTickStep) yTicks.push(v);

  const tipFlip = tip && (tip.xc + MARGIN.left) > w * 0.6;

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg width={w} height={h} style={{ display: "block" }}>
        <g transform={`translate(${MARGIN.left},0)`}>
          {yTicks.map(v => (
            <g key={v}>
              <line x1={0} x2={innerW} y1={ys(v)} y2={ys(v)}
                stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3,3" />
              <text x={-8} y={ys(v)} textAnchor="end" dominantBaseline="middle"
                fontSize={9} fill="var(--text-muted)">{fmtK(v)}</text>
            </g>
          ))}

          {violins.map(({ seg, xc, kd, stats }) => (
            <g key={seg.key}
              onMouseEnter={() => stats && setTip({ seg, stats, xc })}
              onMouseLeave={() => setTip(null)}
              style={{ cursor: stats ? "pointer" : "default" }}
            >
              {kd.length > 0 && (
                <path
                  d={buildPath(kd, xc)}
                  fill={seg.color} fillOpacity={0.25}
                  stroke={seg.color} strokeWidth={1.5}
                />
              )}
              {stats && (
                <>
                  <rect
                    x={xc - halfVW * 0.22} y={ys(stats.q3)}
                    width={halfVW * 0.44}
                    height={Math.max(1, ys(stats.q1) - ys(stats.q3))}
                    fill={seg.color} fillOpacity={0.55} rx={2}
                  />
                  <line
                    x1={xc - halfVW * 0.28} x2={xc + halfVW * 0.28}
                    y1={ys(stats.median)} y2={ys(stats.median)}
                    stroke="white" strokeWidth={1.5}
                  />
                  <circle cx={xc} cy={ys(stats.median)} r={3}
                    fill="white" stroke={seg.color} strokeWidth={1.5} />
                </>
              )}
              <text x={xc} y={h - MARGIN.bottom + 14} textAnchor="middle"
                fontSize={9.5} fill="var(--text)" fontWeight={500}>
                {seg.key.split(" ")[0]}
              </text>
              <text x={xc} y={h - MARGIN.bottom + 26} textAnchor="middle"
                fontSize={9} fill="var(--text-muted)">
                {seg.key.split(" ").slice(1).join(" ")}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {tip && (
        <div style={{
          position: "absolute",
          left: tipFlip
            ? tip.xc + MARGIN.left - 148
            : tip.xc + MARGIN.left + 14,
          top: h * 0.18,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "9px 12px",
          fontSize: 11,
          lineHeight: 1.75,
          pointerEvents: "none",
          zIndex: 10,
          minWidth: 140,
        }}>
          <div style={{ fontWeight: 700, color: tip.seg.color, marginBottom: 4 }}>{tip.seg.key}</div>
          <div style={{ color: "var(--text-muted)" }}>
            Median: <strong style={{ color: "var(--text)" }}>{fmtK(tip.stats.median)}</strong>
          </div>
          <div style={{ color: "var(--text-muted)" }}>
            IQR: <strong style={{ color: "var(--text)" }}>{fmtK(tip.stats.q1)} – {fmtK(tip.stats.q3)}</strong>
          </div>
          <div style={{ color: "var(--text-muted)" }}>
            Counties: <strong style={{ color: "var(--text)" }}>{tip.stats.n}</strong>
          </div>
          <div style={{ color: "var(--text-muted)", marginTop: 3, borderTop: "1px solid var(--border)", paddingTop: 3 }}>
            <span style={{ color: "#E5342A", fontWeight: 600 }}>Trump</span>{" "}
            {tip.stats.trumpN}{" / "}
            <span style={{ color: "#3B82F6", fontWeight: 600 }}>Harris</span>{" "}
            {tip.stats.n - tip.stats.trumpN}
          </div>
        </div>
      )}
    </div>
  );
}
