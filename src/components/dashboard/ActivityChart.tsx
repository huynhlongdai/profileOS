'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ActivityChartProps {
  data: { date: string, count: number }[]
}

export default function ActivityChart({ data }: ActivityChartProps) {
  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-gray-500">No data available</div>
  }

  // Reverse data to show oldest to newest (left to right) if needed, based on API
  // but let's assume API returns it sorted correctly or we can just use the natural array order.
  
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-surface)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            itemStyle={{ color: 'var(--accent)' }}
          />
          <Line 
            type="monotone" 
            dataKey="count" 
            name="Logs"
            stroke="var(--accent)" 
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: 'var(--bg-surface)' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
