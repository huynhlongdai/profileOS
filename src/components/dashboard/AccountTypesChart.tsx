'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface AccountTypesChartProps {
  data: Record<string, number>
}

// Generate colors based on index for the pie chart
const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#818cf8', '#f472b6']

export default function AccountTypesChart({ data }: AccountTypesChartProps) {
  if (!data || Object.keys(data).length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-gray-500">No data available</div>
  }

  // Transform Record into Array for Recharts
  const chartData = Object.entries(data)
    .filter(([_, count]) => count > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value) // Largest first

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-surface)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            itemStyle={{ color: 'var(--text-primary)' }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'capitalize' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
