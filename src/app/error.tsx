'use client';

import { clearCache } from '@/lib/queries';

// Shown instead of a blank page if the app crashes while rendering.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">Noget gik galt</h1>
      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
        Appen ramte en fejl. Dine data er ikke påvirket.
      </p>
      <button
        className="btn btn-accent mt-2"
        onClick={() => {
          // Locally saved data is the likeliest cause, so start from a fresh copy.
          clearCache();
          reset();
        }}
      >
        Prøv igen
      </button>
    </div>
  );
}
