import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, Mail, ArrowLeft, Sun, Moon } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const code = err.code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos.');
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Espera un momento e intenta de nuevo.');
      } else {
        setError('Error al iniciar sesión: ' + err.message);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative transition-colors duration-200">
      {/* Theme toggle in top right */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-amber-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
          title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label="Alternar tema"
        >
          {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-gray-600" />}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Logo Smartbits */}
        <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-brand-400 rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-xl shadow-brand-400/40">
                S
            </div>
        </div>

        <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
          Panel de Administración
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Ingresa tus credenciales para continuar
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-900 py-8 px-4 shadow-xl shadow-gray-200/50 dark:shadow-black/50 sm:rounded-2xl sm:px-10 border border-gray-100 dark:border-gray-800 transition-colors duration-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* Input Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Correo Electrónico
              </label>
              <div className="mt-2 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-700 rounded-xl py-3 bg-gray-50 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 border"
                  placeholder="admin@smartbits.ve"
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Contraseña
              </label>
              <div className="mt-2 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-700 rounded-xl py-3 bg-gray-50 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Mensaje de Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-950/50 border-l-4 border-red-500 p-4 rounded-md animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                        {error}
                    </p>
                </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-70 cursor-pointer"
              >
                {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>
          
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
              <Link to="/" className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Volver al lado del cliente (Catálogo)
              </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
