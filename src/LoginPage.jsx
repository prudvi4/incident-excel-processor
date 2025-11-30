// src/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [showError, setShowError] = useState(false);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  function showInvalid() {
    setShowError(true);
    // auto-hide after a while (optional)
    // setTimeout(() => setShowError(false), 4000);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setProcessing(true);

    // small timeout to simulate "checking" and let animation appear
    setTimeout(() => {
      setProcessing(false);
      if (user === 'admin' && pass === 'admin') {
        try { localStorage.setItem('erp_auth', '1'); } catch (_) {}
        navigate('/', { replace: true });
      } else {
        showInvalid();
      }
    }, 350);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg,#f0fdf4,#ecfeff)',
      padding: 20,
      fontFamily: 'Inter, Roboto, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial'
    }}>
      <div style={{
        width: 430,
        background: 'white',
        borderRadius: 14,
        boxShadow: '0 10px 35px rgba(2,6,23,0.12)',
        padding: '28px 28px',
        position: 'relative',
        overflow: 'visible'
      }}>
        <div style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#0f172a' }}>Welcome back</h2>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Sign in to ERPA — Incident Excel Processor</div>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
          <label style={{ fontSize: 13, color: '#334155', display: 'block', marginBottom: 6 }}>User ID</label>
          <input
            value={user}
            onChange={e => setUser(e.target.value)}
            placeholder="Enter user id"
            style={{
              width: '100%',
              padding: '10px 12px',
              marginBottom: 12,
              borderRadius: 8,
              border: '1px solid #e6eef0',
              fontSize: 14,
              boxSizing: 'border-box'
            }}
            autoFocus
          />

          <label style={{ fontSize: 13, color: '#334155', display: 'block', marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            placeholder="Enter your password"
            style={{
              width: '100%',
              padding: '10px 12px',
              marginBottom: 18,
              borderRadius: 8,
              border: '1px solid #e6eef0',
              fontSize: 14,
              boxSizing: 'border-box'
            }}
          />

          <button
            type="submit"
            disabled={processing}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 8,
              border: 'none',
              background: processing ? '#7dd3fc' : '#06b6d4',
              color: 'white',
              fontWeight: 700,
              fontSize: 15,
              cursor: processing ? 'wait' : 'pointer',
              boxShadow: '0 6px 18px rgba(6,182,212,0.16)'
            }}
          >
            {processing ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Small footer text removed as requested (no demo button, no tips) */}

        {/* Error modal */}
        {showError && (
          <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(2,6,23,0.45)',
            zIndex: 9999,
            padding: 20
          }}>
            <div style={{
              width: 380,
              background: 'white',
              borderRadius: 12,
              boxShadow: '0 12px 40px rgba(2,6,23,0.45)',
              padding: 22,
              textAlign: 'left',
              transform: 'translateY(0)',
              animation: 'modal-pop .26s cubic-bezier(.2,.9,.3,1)'
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(180deg,#ffecd1,#ffd1d1)'
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#fee2e2"/>
                    <path d="M12 7.75a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0112 7.75z" fill="#b91c1c"/>
                    <path d="M12 17.25a1 1 0 100-2 1 1 0 000 2z" fill="#b91c1c"/>
                  </svg>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Invalid credentials</div>
                  <div style={{ marginTop: 6, color: '#475569', fontSize: 14 }}>
                    The user ID or password you entered is incorrect. Please check and try again.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, gap: 8 }}>
                <button onClick={() => setShowError(false)} style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #e6eef0',
                  background: 'white',
                  color: '#0f172a',
                  cursor: 'pointer'
                }}>Cancel</button>

                <button onClick={() => { setShowError(false); setPass(''); setUser(''); }} style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#ef4444',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 700
                }}>
                  Try again
                </button>
              </div>
            </div>

            {/* simple keyframes (inline) */}
            <style>{`
              @keyframes modal-pop {
                from { transform: translateY(-10px) scale(.98); opacity: 0; }
                to   { transform: translateY(0) scale(1); opacity: 1; }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}
