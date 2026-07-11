import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError } = useAuth();

  // Espera a que el SDK de Firebase complete la hidratación de la sesión inicial
  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  // Si hay un error de infraestructura crítico o el usuario no está autenticado,
  // se delega la acción al elemento no autenticado (ej. redirección declarativa a /login)
  if (authError || !isAuthenticated) {
    return unauthenticatedElement;
  }

  // Si la sesión es válida y está confirmada, renderiza las sub-rutas protegidas
  return <Outlet />;
}