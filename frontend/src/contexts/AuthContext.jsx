import { createContext, useCallback, useEffect, useState, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { AUTH_REQUIRED_EVENT } from '../services/api';

const AuthContext = createContext({});

function normalizeUser(userData) {
    return {
        ...userData,
        role: userData?.role?.toLowerCase(),
    };
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    const recoverUser = useCallback(async () => {
        try {
            const userResponse = await api.get('/auth/me');
            setUser(normalizeUser(userResponse.data));
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        recoverUser();
    }, [recoverUser]);

    useEffect(() => {
        function handleAuthRequired() {
            setUser(null);
            setLoading(false);

            const isAuthPage = location.pathname.startsWith('/login') || location.pathname.startsWith('/register');
            if (!isAuthPage) {
                navigate('/login', { replace: true });
            }
        }

        window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
        return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    }, [location.pathname, navigate]);

    const login = async (identifier, password) => {
        try {
            await api.post('/auth/login', { identifier, password });
            const userResponse = await api.get('/auth/me');
            setUser(normalizeUser(userResponse.data));
            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            const status = error.response?.status;
            const detail = error.response?.data?.detail;

            // Tratamento específico de rate limit (HTTP 429)
            if (status === 429) {
                return {
                    success: false,
                    rateLimited: true,
                    message: detail || 'Muitas tentativas de login. Aguarde 1 minuto antes de tentar novamente.',
                };
            }

            return {
                success: false,
                rateLimited: false,
                message: detail || (error.request
                    ? 'Não foi possível conectar ao backend. Verifique se a API está rodando em http://127.0.0.1:8000.'
                    : 'Erro ao realizar login'),
            };
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.warn('Logout warning:', error);
        } finally {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ authenticated: !!user, user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
