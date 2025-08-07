// Deprecated in favor of app/providers.tsx. Keeping a no-op wrapper for backward compatibility.
import React from 'react';

export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const queryClient = undefined as unknown as never;
