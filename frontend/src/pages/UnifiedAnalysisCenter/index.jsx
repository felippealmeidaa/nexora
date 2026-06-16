import React from 'react';

import { useDataMode } from '@/contexts/DataModeContext';
import { AnalysisCenter as HistoricalAnalysisCenter } from '@/pages/AnalysisCenter';

export function UnifiedAnalysisCenter() {
    const { dataMode } = useDataMode();

    if (dataMode === 'real') {
        return <HistoricalAnalysisCenter dataSource="live" />;
    }

    return <HistoricalAnalysisCenter dataSource="historical" />;
}
