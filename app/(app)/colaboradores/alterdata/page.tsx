
// app/(app)/colaboradores/alterdata/page.tsx
import { Suspense } from "react";
import AlterdataClient from "./pro/AlterdataClient";

export const metadata = {
  title: "Alterdata Completo",
};

export default async function Page() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Alterdata Completo</h1>
      </div>
      <Suspense fallback={<SkeletonView/>}>
        {/* Client component com cache e estado persistente */}
        <AlterdataClient />
      </Suspense>
    </div>
  );
}

function SkeletonView() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-10 w-full rounded-xl animate-pulse bg-gray-200/60" />
      <div className="h-10 w-2/3 rounded-xl animate-pulse bg-gray-200/60" />
      <div className="h-[60vh] w-full rounded-2xl animate-pulse bg-gray-200/60" />
    </div>
  );
}
