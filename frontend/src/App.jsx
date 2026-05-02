import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard    from "./pages/Dashboard";
import CountyDetail from "./pages/CountyDetail";
import Analytics    from "./pages/Analytics";
import Education    from "./pages/Education";
import Ethnic       from "./pages/Ethnic";
import Economic     from "./pages/Economic";
import SmartQuery      from "./pages/SmartQuery";
import StandardQuery   from "./pages/StandardQuery";
import Layout       from "./components/layout/Layout";

function Placeholder({ title }) {
  return (
    <Layout>
      <div className="page-content">
        <div className="card card-body" style={{ color: "var(--text-muted)", fontSize: 14 }}>
          {title} - coming soon.
        </div>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/"                    element={<Dashboard />} />
      <Route path="/elections/:electionId" element={<Navigate to="/" replace />} />
      <Route path="/county/:fips"        element={<CountyDetail />} />
      <Route path="/analytics"           element={<Analytics />} />
      <Route path="/education"           element={<Education />} />
      <Route path="/ethnic"             element={<Ethnic />} />
      <Route path="/economic"           element={<Economic />} />
      <Route path="/smart-query"         element={<SmartQuery />} />
      <Route path="/standard-query"     element={<StandardQuery />} />
      <Route path="/reports"             element={<Placeholder title="Reports" />} />
      <Route path="/settings"            element={<Placeholder title="Settings" />} />
      <Route path="*"                    element={<Navigate to="/" replace />} />
    </Routes>
  );
}
