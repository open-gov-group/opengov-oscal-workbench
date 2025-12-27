import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SDMControlsPage from "./pages/SdmcontrolsPage";
import ResilienceControlsPage from "./pages/ResilienceControlsPage";
import PrivacyCatalogPage from "./pages/PrivacyCatalogPage";

const App: React.FC = () => {
  return (
    <Routes>
      {/* Default: nach /sdm umleiten */}
      <Route path="/" element={<Navigate to="/sdm" replace />} />
      <Route path="/sdm" element={<SDMControlsPage />} />
      <Route path="/resilience" element={<ResilienceControlsPage />} />
      <Route path="/privacy" element={<PrivacyCatalogPage />} />
    </Routes>
  );
};

export default App;
