import { useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center">
        <h1 className="text-7xl font-light text-slate-300">404</h1>

        <div className="h-0.5 w-16 bg-slate-200 mx-auto my-6"></div>

        <h2 className="text-2xl font-medium text-slate-800">
          Página no encontrada
        </h2>

        <p className="text-slate-600 mt-4">
          La página "<strong>{pageName}</strong>" no existe.
        </p>

        <button
          onClick={() => (window.location.href = "/")}
          className="mt-8 px-4 py-2 border rounded-lg"
        >
          Ir al inicio
        </button>
      </div>
    </div>
  );
}