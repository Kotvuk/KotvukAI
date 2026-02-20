import React from 'react';
import { createRoot } from 'react-dom/client';
import { LangProvider } from './LangContext';
import { AuthProvider } from './AuthContext';
import App from './App';
createRoot(document.getElementById('root')).render(
  <LangProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </LangProvider>
);
