export const API_BASE =
    typeof window !== 'undefined'
        ? '/api'                       // navegador (producción con nginx)
        : 'http://127.0.0.1:8080/api';  // SSR/Node (si llegas a usarlo)