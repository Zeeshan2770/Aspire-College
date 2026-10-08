import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from '@/hooks/useAuth';
import ConfigError from './ConfigError';
import { isSupabaseConfigured } from '@/lib/supabase';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  !isSupabaseConfigured ? (
    <ConfigError />
  ) : (
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { borderRadius: '12px', fontSize: '14px' },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
  )
);
