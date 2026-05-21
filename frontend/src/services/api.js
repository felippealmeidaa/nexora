import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const url = error.config?.url || '';
            const isAuthEndpoint = [
                '/auth/login',
                '/auth/logout',
                '/auth/me',
                '/auth/register',
            ].some((path) => url.includes(path));
            const isPublicEndpoint = url.includes('/courses/available');
            const isAuthPage = window.location.pathname.startsWith('/login')
                || window.location.pathname.startsWith('/register');

            if (!isAuthEndpoint && !isPublicEndpoint && !isAuthPage) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
