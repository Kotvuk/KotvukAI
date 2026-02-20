import React from 'react';
import { createRoot } from 'react-dom/client';
import { LangProvider } from './LangContext';
import { AuthProvider } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import App from './App';
createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <LangProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LangProvider>
  </ThemeProvider>
);
