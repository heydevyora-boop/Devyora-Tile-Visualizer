import { Route, Routes } from 'react-router-dom'
import { FlowProvider } from './state/FlowContext'
import Home from './pages/Home'
import Camera from './pages/Camera'
import Crop from './pages/Crop'
import TileSize from './pages/TileSize'
import Space from './pages/Space'
import Style from './pages/Style'
import Summary from './pages/Summary'
import Loading from './pages/Loading'
import Results from './pages/Results'
import './App.css'

function App() {
  return (
    <FlowProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/crop" element={<Crop />} />
        <Route path="/tile-size" element={<TileSize />} />
        <Route path="/space" element={<Space />} />
        <Route path="/style" element={<Style />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </FlowProvider>
  )
}

export default App
