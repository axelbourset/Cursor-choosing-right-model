import { createRoot } from 'react-dom/client'
import './tokens.css'
import './squircle.css'
import './styles.css'
import App from './App'
const el = document.getElementById('root')
if (!el) throw new Error('#root not found')
createRoot(el).render(<App />)
