'use client';

import { FlightPlanProvider } from '@/context/FlightPlanContext';
import { MonitoredDataProvider } from '@/context/MonitoredDataContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FlightPlanProvider>
      <MonitoredDataProvider>
        {children}
      </MonitoredDataProvider>
    </FlightPlanProvider>
  );
}

