// src/api/base44Client.js
// Compatibilidad temporal después de migrar de Base44 a Firebase.

export const base44 = {
  auth: {
    me: async () => null,
    logout: () => {},
    redirectToLogin: () => {
      window.location.href = '/login';
    }
  },
  entities: {},
  functions: {}
};

export default base44;