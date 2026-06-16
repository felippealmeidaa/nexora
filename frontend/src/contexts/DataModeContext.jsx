import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const DATA_MODE_KEY = 'nexora_data_mode';
const DataModeContext = createContext({
    dataMode: 'real',
    setDataMode: () => {},
    canToggleDataMode: false,
});

function normalizeMode(value) {
    return value === 'historical' ? 'historical' : 'real';
}

function roleSupportsDataMode(role) {
    return ['admin', 'professor', 'coordinator'].includes(String(role || '').toLowerCase());
}

export function DataModeProvider({ role, children }) {
    const [dataMode, setDataModeState] = useState(() => {
        if (typeof window === 'undefined') {
            return 'real';
        }
        return normalizeMode(localStorage.getItem(DATA_MODE_KEY));
    });

    const canToggleDataMode = roleSupportsDataMode(role);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        localStorage.setItem(DATA_MODE_KEY, dataMode);
    }, [dataMode]);

    useEffect(() => {
        if (!canToggleDataMode && dataMode !== 'real') {
            setDataModeState('real');
        }
    }, [canToggleDataMode, dataMode]);

    const value = useMemo(() => ({
        dataMode,
        setDataMode: (nextMode) => setDataModeState(normalizeMode(nextMode)),
        canToggleDataMode,
    }), [canToggleDataMode, dataMode]);

    return (
        <DataModeContext.Provider value={value}>
            {children}
        </DataModeContext.Provider>
    );
}

export function useDataMode() {
    return useContext(DataModeContext);
}
