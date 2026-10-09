import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { startMockNetwork } from './mocks/start';

async function bootstrap() {
  // The Service Worker must be ready before the auction engine issues its first
  // bid request, otherwise real traffic could theoretically escape.
  await startMockNetwork();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();