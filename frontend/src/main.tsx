import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { GatekeeperProvider } from './store/useGatekeeperStore';
import './styles/tokens.css';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(<StrictMode><GatekeeperProvider><App /></GatekeeperProvider></StrictMode>);
