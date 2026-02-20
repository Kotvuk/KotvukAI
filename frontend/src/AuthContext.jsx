import React, { createContext, useContext, useState, useEffect } from 'react';
const AuthContext = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(u => { setUser(u); setLoading(false); })
        .catch(() => { setToken(null); localStorage.removeItem('token'); setLoading(false); });
    } else { setLoading(false); }
  }, [token]);

  const login = (t, u) => { setToken(t); setUser(u); localStorage.setItem('token', t); };
  const logout = () => { setToken(null); setUser(null); localStorage.removeItem('token'); };

  return <AuthContext.Provider value={{ user, token, login, logout, loading }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
