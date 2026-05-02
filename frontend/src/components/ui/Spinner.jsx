export default function Spinner({ center = true }) {
  if (!center) return <div className="spinner" />;
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
      <div className="spinner" />
    </div>
  );
}
