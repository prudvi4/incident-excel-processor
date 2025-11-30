// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import IncidentExcelProcessor from './IncidentExcelProcessor';
import LoginPage from './LoginPage';

/*
  App.js - routing + simple client-side auth
  - Login sets localStorage.setItem('erp_auth','1')
  - Root is protected and receives onLogout prop to sign out
*/

function RequireAuth({ children }) {
  // simple client-side auth flag
  const isAuth = !!localStorage.getItem('erp_auth');
  if (!isAuth) return <Navigate to="/login" replace />;
  return children;
}

/* Wrapper component to inject onLogout into IncidentExcelProcessor */
function IncidentExcelProcessorWithLogout() {
  const navigate = useNavigate();

  function handleLogout() {
    // remove auth flag and go to login
    try { localStorage.removeItem('erp_auth'); } catch (e) { /* ignore */ }
    navigate('/login', { replace: true });
  }

  return <IncidentExcelProcessor onLogout={handleLogout} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public login page */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected home route (root) */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <IncidentExcelProcessorWithLogout />
            </RequireAuth>
          }
        />

        {/* Optional alias */}
        <Route
          path="/home"
          element={
            <RequireAuth>
              <IncidentExcelProcessorWithLogout />
            </RequireAuth>
          }
        />

        {/* Fallback: redirect anything else to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
