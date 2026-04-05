import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
});

export const withHeaders = (role = 'mentor', userId = 1) => ({
  headers: {
    'x-role': role,
    'x-user-id': userId,
  },
});

export default api;
