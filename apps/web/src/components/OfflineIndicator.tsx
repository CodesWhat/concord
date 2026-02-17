import { useState, useEffect } from "react";
import { offlineSync } from "../utils/offlineSync.js";

export default function OfflineIndicator() {
  const [online, setOnline] = useState(offlineSync.online);

  useEffect(() => {
    return offlineSync.subscribe(setOnline);
  }, []);

  if (online) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-yellow-600/90 px-4 py-1.5 text-sm font-medium text-white">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      You are offline — messages will be sent when you reconnect
    </div>
  );
}
