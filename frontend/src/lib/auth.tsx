import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const TOKEN_KEY = 'vector.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

interface AuthContextValue {
  status: 'checking' | 'authenticated' | 'anonymous'
  email: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Chiamata direttamente (non via lib/api.ts) per evitare un ciclo di
// dipendenze: api.ts legge il token da qui per allegarlo alle richieste.
async function fetchMe(token: string): Promise<{ ok: true; email: string }> {
  const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('unauthenticated')
  return res.json()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('checking')
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setStatus('anonymous')
      return
    }
    fetchMe(token)
      .then((data) => {
        setEmail(data.email)
        setStatus('authenticated')
      })
      .catch(() => {
        setToken(null)
        setStatus('anonymous')
      })
  }, [])

  // Un 401 da qualunque chiamata API (token scaduto/revocato a runtime)
  // riporta subito allo stato anonimo, senza dover ricaricare la pagina.
  useEffect(() => {
    function handleUnauthorized() {
      setToken(null)
      setEmail(null)
      setStatus('anonymous')
    }
    window.addEventListener('vector:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('vector:unauthorized', handleUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.token) {
      throw new Error((data && data.error) || 'Credenziali non valide.')
    }
    setToken(data.token)
    setEmail(data.email)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setEmail(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(() => ({ status, email, login, logout }), [status, email, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth va usato dentro <AuthProvider>')
  return ctx
}
