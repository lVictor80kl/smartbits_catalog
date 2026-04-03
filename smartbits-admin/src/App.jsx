import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import NewLaptop from './pages/admin/NewLaptop';
import EditLaptop from './pages/admin/EditLaptop';
import SyncLaptops from './pages/admin/SyncLaptops';
import DeliveryNote from './pages/admin/DeliveryNote';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Login Público */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Login />} />

          {/* Rutas de Administrador Protegidas */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="new" element={<NewLaptop />} />
            <Route path="edit/:id" element={<EditLaptop />} />
            <Route path="sync" element={<SyncLaptops />} />
            <Route path="delivery/:id" element={<DeliveryNote />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
