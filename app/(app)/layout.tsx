import React from "react";
import AppShell from "@/components/layout/AppShell";

export default function RootAppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
