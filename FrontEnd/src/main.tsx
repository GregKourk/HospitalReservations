import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@/components/keenicons/assets/styles.css';
import './css/styles.css';
import './css/travelsheets.css'
import 'devextreme/dist/css/dx.light.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import axios from 'axios';
import { setUpAxios } from '@/auth/lib/helpers';
import { loadConfig } from './Services/loadConfig';
import { locale, loadMessages } from 'devextreme/localization';
import elMessages from 'devextreme/localization/messages/el.json';

// configure axios once at startup so that every request includes
// the Authorization header when a token is available.
setUpAxios(axios);

// Greek UI strings for every DevExtreme widget (grid buttons, confirm
// dialogs, pager, filter row, popup Save/Cancel, ...) — otherwise these
// default to English while the rest of the app is Greek.
loadMessages(elMessages);
locale('el');

loadConfig().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}).catch((error) => {
    console.error('Failed to load config', error);
    // Optionally, render an error message to the user
    const root = createRoot(document.getElementById('root')!);
    root.render(
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Failed to load configuration</h1>
        <p>Please try again later.</p>
      </div>
    );
});