import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface FlowratePieChartProps { 
  data: { pointSystemId: number; flowrate: number }[];
  pointSystemColors: Record<number, string>;
  pointSystemNames: Record<number, string>;
}

const FlowratePieChart: React.FC<FlowratePieChartProps> = ({ 
  data, 
  pointSystemColors, 
  pointSystemNames 
}) => {
  const chartData = data.map(item => ({
    name: pointSystemNames[item.pointSystemId],
    value: item.flowrate,
    color: pointSystemColors[item.pointSystemId]
  }));

  return (
    <div className="w-12 h-12 mr-2">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={20}
            paddingAngle={1}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => `${value.toFixed(1)}%`}
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FlowratePieChart; 