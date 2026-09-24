import { Route, Routes } from 'react-router-dom'
import { FlowProvider } from './state/FlowContext'
import { AuthProvider } from './state/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import Camera from './pages/Camera'
import Crop from './pages/Crop'
import TileSize from './pages/TileSize'
import Space from './pages/Space'
import Style from './pages/Style'
import Summary from './pages/Summary'
import Loading from './pages/Loading'
import Results from './pages/Results'
import History from './pages/History'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import RecentGenerations from './pages/RecentGenerations'
import SavedConcepts from './pages/SavedConcepts'
import Settings from './pages/Settings'
import ClientSelect from './pages/ClientSelect'
import CustomerDetail from './pages/CustomerDetail'
import RequireClient from './components/RequireClient'
import './App.css'

/**
 * Every page in the consultation flow. These require the "user" role, not just
 * a session: admins are review-only and get redirected to /history if they try
 * to reach any of them.
 */
const WORKSPACE_ROUTES = [
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/clients', element: <Clients /> },
  { path: '/clients/:customerId', element: <CustomerDetail /> },
  { path: '/recent', element: <RecentGenerations /> },
  { path: '/saved', element: <SavedConcepts /> },
  { path: '/settings', element: <Settings /> },
  // Where a consultation begins: choosing whose it is.
  { path: '/start', element: <ClientSelect /> },
]

/**
 * The consultation itself. Every one of these additionally requires a chosen
 * client, so concepts always have a customer to be filed against.
 */
const FLOW_ROUTES = [
  { path: '/home', element: <Home /> },
  { path: '/camera', element: <Camera /> },
  { path: '/crop', element: <Crop /> },
  { path: '/tile-size', element: <TileSize /> },
  { path: '/space', element: <Space /> },
  { path: '/style', element: <Style /> },
  { path: '/summary', element: <Summary /> },
  { path: '/loading', element: <Loading /> },
  { path: '/results', element: <Results /> },
]

function App() {
  return (
    <AuthProvider>
      <FlowProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          {WORKSPACE_ROUTES.map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={<ProtectedRoute requireRole="user">{element}</ProtectedRoute>}
            />
          ))}
          {FLOW_ROUTES.map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute requireRole="user">
                  <RequireClient>{element}</RequireClient>
                </ProtectedRoute>
              }
            />
          ))}
          <Route
            path="/history"
            element={
              <ProtectedRoute requireRole="admin">
                <History />
              </ProtectedRoute>
            }
          />
        </Routes>
      </FlowProvider>
    </AuthProvider>
  )
}

export default App
