import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ClientLayout from './components/layout/ClientLayout';
import Catalog from './pages/Catalog';
import ComponentsCatalog from './pages/ComponentsCatalog';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ClientLayout />}>
          <Route index element={<Catalog />} />
          <Route path="componentes" element={<ComponentsCatalog />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
