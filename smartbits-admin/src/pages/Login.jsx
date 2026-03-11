import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ArrowLeft } from 'lucide-react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Si venía de intentar entrar a /admin, lo regresamos allí tras el login. Si no, al dashboard.
  const from = location.state?.from?.pathname || '/admin';

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulamos un leve delay
    setTimeout(() => {
        const success = login(password);
        if (success) {
            navigate(from, { replace: true });
        } else {
            setError('Contraseña incorrecta. Inténtalo de nuevo.');
            setIsLoading(false);
        }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Logo Smartbits */}
        <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-brand-400 rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-xl shadow-brand-400/40">
                S
            </div>
        </div>

        <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
          Panel de Administración
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Ingresa tus credenciales para continuar
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* Input Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña Administrativa
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-xl py-3 bg-gray-50 outline-none transition-all placeholder-gray-400 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Mensaje de Error */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm text-red-700 font-medium">
                        {error}
                    </p>
                </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-70"
              >
                {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>
          
          <div className="mt-6 pt-6 border-t border-gray-100">
              <Link to="/" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-brand-600 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Volver al lado del cliente (Catálogo)
              </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
