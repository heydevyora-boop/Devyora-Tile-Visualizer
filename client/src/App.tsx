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
import './App.css'

/** Every page in the consultation flow sits behind sign-in. */
const PROTECTED_ROUTES = [
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
          {PROTECTED_ROUTES.map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={<ProtectedRoute>{element}</ProtectedRoute>}
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
