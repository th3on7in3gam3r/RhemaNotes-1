import React, { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';
import { getPendingSyncCount } from '../services/storageService';

export const PendingSyncBanner: React.FC = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => getPendingSyncCount().then(setCount);
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  if (count === 0) return null;

  return (
    <div className="w-full mb-6 flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-sm font-bold">
      <CloudOff className="w-5 h-5 shrink-0 text-amber-600" />
      <span>
        {count} sermon{count === 1 ? '' : 's'} waiting to sync to the cloud. They are saved on this device and will upload when online.
      </span>
    </div>
  );
};
