import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AppContextProvider } from './contexts/AppContextProvider'

createRoot(document.getElementById("root")!).render(
  <AppContextProvider>
    <App />
  </AppContextProvider>
);