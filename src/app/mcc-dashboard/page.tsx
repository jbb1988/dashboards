'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MCCDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main dashboard with MCC tab active
    router.replace('/closeout-dashboard?tab=mcc');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
      <div className="text-center">
        <div className="text-white text-lg mb-2">Redirecting to MCC Profitability...</div>
        <div className="text-gray-400 text-sm">
          The MCC dashboard is now integrated into the main profitability dashboard.
        </div>
      </div>
    </div>
  );
}
