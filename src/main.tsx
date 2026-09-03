import { createRoot } from 'react-dom/client'
import '@fontsource/anton'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import './tokens.css'
import './styles.css'
import { App } from './App'
const el = document.getElementById('root')
if (!el) throw new Error('#root not found')
createRoot(el).render(<App />)
