'use client';

import { FlightPlanProvider } from '@/context/FlightPlanContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FlightPlanProvider>
      {children}
    </FlightPlanProvider>
  );
}

