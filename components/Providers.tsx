"use client";

import { UpdatePrompt } from "./UpdatePrompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UpdatePrompt />
      {children}
    </>
  );
}
