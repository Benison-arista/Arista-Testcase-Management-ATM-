import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Attach JWT to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('atm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('atm_token');
      localStorage.removeItem('atm_user');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default client;
