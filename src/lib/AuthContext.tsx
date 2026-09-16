'use client';
import { createContext, useContext, useEffect, useState } from 'react';

// Stato admin lato client: serve solo a mostrare/nascondere i controlli.
// La vera protezione resta nel proxy delle API (src/proxy.ts).
type AuthContextType = {
  isAdmin: boolean;
  authLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({ isAdmin: false, authLoading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => setIsAdmin(!!data.isAdmin))
        .catch(() => setIsAdmin(false))
        .finally(() => setAuthLoading(false));
  }, []);

  return (
      <AuthContext.Provider value={{ isAdmin, authLoading }}>
        {children}
      </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
