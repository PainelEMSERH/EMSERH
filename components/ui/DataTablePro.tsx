
// components/ui/DataTablePro.tsx
"use client";

import { useRef, useState, useMemo, useEffect } from "react";

type Column = {
  key: string;
  header: string;
  width?: number;
  pin?: "left" | "right";
  sortable?: boolean;
};

export default function DataTablePro({
  loading,
  data,
  columns,
  height = 600,
  rowHeight = 44,
  sortBy,
  sortDir,
  onSortChange,
}: {
  loading?: boolean;
  data: any[];
  columns: Column[];
  height?: number;
  rowHeight?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: string, dir: "asc" | "desc") => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const totalRows = data.length;
  const totalHeight = totalRows * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 10);
  const visibleCount = Math.ceil(height / rowHeight) + 20;
  const endIndex = Math.min(totalRows, startIndex + visibleCount);

  const totalWidth = useMemo(
    () => columns.reduce((acc, c) => acc + (c.width ?? 180), 0),
    [columns]
  );

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    const nextDir = sortBy === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    onSortChange(key, nextDir);
  };

  return (
    <div className="relative rounded-2xl border">
      <div className="border-b rounded-t-2xl overflow-hidden">
        <div className="flex bg-muted/50 sticky top-0 z-10" style={{ minWidth: totalWidth }}>
          {columns.map((col) => (
            <div
              key={col.key}
              className={`px-3 py-2 text-sm font-medium border-r last:border-r-0 ${col.pin ? "sticky bg-muted/50" : ""} ${col.pin === "left" ? "left-0" : col.pin === "right" ? "right-0" : ""}`}
              style={{ width: col.width ?? 180 }}
              onClick={() => col.sortable && toggleSort(col.key)}
            >
              <div className="flex items-center gap-1 cursor-default select-none">
                <span>{col.header}</span>
                {col.sortable && (
                  <span className="text-xs opacity-70">
                    {sortBy === col.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div ref={parentRef} style={{ height, overflow: "auto" }} className="rounded-b-2xl">
        <div style={{ height: totalHeight, position: "relative", minWidth: totalWidth }}>
          {Array.from({ length: endIndex - startIndex }, (_, i) => startIndex + i).map((rowIndex) => {
            const row = data[rowIndex];
            const top = rowIndex * rowHeight;
            return (
              <div
                key={rowIndex}
                className="flex border-b absolute left-0 right-0"
                style={{
                  transform: `translateY(${top}px)`,
                  height: rowHeight,
                }}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={`px-3 flex items-center text-sm border-r last:border-r-0 ${col.pin ? "sticky bg-background" : ""} ${col.pin === "left" ? "left-0" : col.pin === "right" ? "right-0" : ""}`}
                    style={{ width: col.width ?? 180 }}
                    title={String(row?.[col.key] ?? "")}
                  >
                    {String(row?.[col.key] ?? "")}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-2xl">
          <div className="animate-pulse text-sm">Carregando…</div>
        </div>
      )}
    </div>
  );
}
