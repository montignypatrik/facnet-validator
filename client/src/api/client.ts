import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

// Request interceptor to add Auth0 token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for auth errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");
      // Redirect to home page, Auth0 will handle login
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default client;
