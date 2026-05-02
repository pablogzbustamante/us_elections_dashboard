import Sidebar from "./Sidebar";

export default function Layout({ children, rightPanel }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        {children}
      </div>
      {rightPanel && (
        <div className="right-panel">
          {rightPanel}
        </div>
      )}
    </div>
  );
}
