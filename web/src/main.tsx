import { createRoot } from 'react-dom/client';
import '@fontsource/marcellus/latin-400.css';
import '@fontsource/karla/latin-400.css';
import '@fontsource/karla/latin-600.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
