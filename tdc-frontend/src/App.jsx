import { useEffect } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from './lib/queryClient'
import { useAuthStore } from './store/authStore'
import { useGlobalLenis } from './hooks/useLenis'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ClientDetail from './pages/ClientDetail'
import NotFound from './pages/NotFound'

// Route guard — redirects to /login when there is no session.
function RequireAuth({ children }) {
  const session = useAuthStore((s) => s.session)
  const initializing = useAuthStore((s) => s.initializing)
  const location = useLocation()

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]">
        <p className="font-playfair text-xl italic text-[#6C6863]">
          One moment…
        </p>
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

function AppRoutes() {
  const session = useAuthStore((s) => s.session)

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/client/:id"
        element={
          <RequireAuth>
            <ClientDetail />
          </RequireAuth>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  const init = useAuthStore((s) => s.init)
  useGlobalLenis()

  useEffect(() => {
    let subscription
    init().then((sub) => {
      subscription = sub
    })
    return () => subscription?.unsubscribe?.()
  }, [init])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="paper-noise" aria-hidden="true" />
        <AppRoutes />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#1A1A1A',
              color: '#F9F8F6',
              borderRadius: '0px',
              fontSize: '11px',
              letterSpacing: '0.15em',
              padding: '12px 16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            },
            success: {
              style: {
                background: '#1A1A1A',
                color: '#F9F8F6',
                borderRadius: '0px',
                fontSize: '11px',
                letterSpacing: '0.15em',
                padding: '12px 16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                borderLeft: '2px solid #D4AF37',
              },
            },
            error: {
              style: {
                background: '#1A1A1A',
                color: '#F9F8F6',
                borderRadius: '0px',
                fontSize: '11px',
                letterSpacing: '0.15em',
                padding: '12px 16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                borderLeft: '2px solid #F9F8F6',
              },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
