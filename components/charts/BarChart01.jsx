'use client';

import { memo, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { getCssVariable, adjustColorOpacity, formatValue } from '@/components/utils/Utils';

function BarChart01({ labels = [], series = [], title = '' }) {
  const primary = getCssVariable('--color-primary', '#3b82f6');
  const grid = adjustColorOpacity(getCssVariable('--muted-foreground', 'rgba(0,0,0,0.3)'), 0.15);

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: title || 'Total',
        data: series,
        backgroundColor: adjustColorOpacity(primary, 0.6),
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  }), [labels, series, primary, title]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: getCssVariable('--foreground', '#111827') },
      },
      y: {
        grid: { color: grid },
        ticks: {
          color: getCssVariable('--foreground', '#111827'),
          callback: (value) => formatValue(value),
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatValue(ctx.parsed.y)}`,
        },
      },
    },
  }), [grid]);

  return (
    <div className="h-64 w-full">
      <Bar data={data} options={options} />
    </div>
  );
}

export default memo(BarChart01);
