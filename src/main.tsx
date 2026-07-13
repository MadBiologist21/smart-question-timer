import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TimerProvider } from './store/TimerContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TimerProvider><App /></TimerProvider>
  </StrictMode>,
)
