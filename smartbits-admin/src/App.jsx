import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import NewLaptop from './pages/admin/NewLaptop';
import EditLaptop from './pages/admin/EditLaptop';
import DeliveryNote from './pages/admin/DeliveryNote';
import MigrateImages from './pages/admin/MigrateImages';
import ComponentsDashboard from './pages/admin/ComponentsDashboard';
import NewComponent from './pages/admin/NewComponent';
import EditComponent from './pages/admin/EditComponent';
import ComponentDeliveryNote from './pages/admin/ComponentDeliveryNote';
import ServiceDeliveryNote from './pages/admin/ServiceDeliveryNote';

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
            <Route path="delivery/:id" element={<DeliveryNote />} />
            <Route path="migrate" element={<MigrateImages />} />
            <Route path="components" element={<ComponentsDashboard />} />
            <Route path="components/new" element={<NewComponent />} />
            <Route path="components/edit/:id" element={<EditComponent />} />
            <Route path="components/delivery/:id" element={<ComponentDeliveryNote />} />
            <Route path="service" element={<ServiceDeliveryNote />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
