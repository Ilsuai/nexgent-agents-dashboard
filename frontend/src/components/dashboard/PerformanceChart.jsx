import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTradingData } from '../../context/TradingDataContext';
import { safeNumber } from '../../utils/numberUtils';

const PerformanceChart = () => {
  const { performanceData, hourlyPerformanceData } = useTradingData();
  const [timeframe, setTimeframe] = useState('ALL');

  // Filter data based on timeframe
  const getFilteredData = () => {
    // Use hourly data for 24H view
    if (timeframe === '24H') {
      return hourlyPerformanceData || [];
    }

    if (!performanceData || performanceData.length === 0) return [];

    let daysBack = performanceData.length; // ALL

    switch(timeframe) {
      case '7D': daysBack = 7; break;
      case '1M': daysBack = 30; break;
      default: daysBack = performanceData.length;
    }

    return performanceData.slice(-daysBack);
  };

  const filteredData = getFilteredData();

  // Data is already formatted as MM/DD from generateEquityCurve
  const formattedData = filteredData.map(item => {
    if (timeframe === '24H') {
      return item; // Keep hourly format for 24H
    }

    // Date is already in MM/DD format from equity curve generator
    return { ...item, formattedDate: item.date };
  });

  // Calculate appropriate interval for XAxis label display
  const getAxisInterval = (dataLength) => {
    if (timeframe === '24H') return 'preserveStartEnd';
    if (dataLength <= 10) return 0; // Show all labels
    if (timeframe === '7D') {
      // For 7D view, show all labels if <= 7 days, otherwise space them out
      return dataLength <= 7 ? 0 : Math.floor(dataLength / 7);
    }
    if (timeframe === '1M') return Math.floor(dataLength / 10);
    return Math.floor(dataLength / 15); // Show ~15 labels for ALL view
  };

  // Don't filter data - pass ALL data points to chart and let XAxis control label spacing
  const displayData = formattedData.length > 0 ? formattedData : [{ date: 'Start', balance: 0 }];
  const axisInterval = getAxisInterval(displayData.length);

  return (
    <div className="glass-card p-6 h-[400px] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h3 className="text-lg font-bold text-white">Portfolio Equity Curve</h3>
           <p className="text-xs text-gray-400">Net Asset Value (NAV) over time</p>
        </div>
        <div className="flex space-x-1 bg-dark-900 p-1 rounded-lg border border-dark-700">
            {['24H', '7D', '1M', 'ALL'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                    timeframe === tf
                      ? 'bg-accent/10 text-accent'
                      : 'text-gray-400 hover:bg-dark-800 hover:text-white'
                  }`}
                >
                    {tf}
                </button>
            ))}
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        {formattedData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-sm font-medium">No trading data yet</p>
              <p className="text-xs mt-1">Waiting for Railway agent trades...</p>
            </div>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
          <AreaChart data={displayData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2128" vertical={false} />
            <XAxis
              dataKey={timeframe === '24H' ? 'time' : 'formattedDate'}
              stroke="#9ca3af"
              tick={{fontSize: 11, fill: '#9ca3af', fontWeight: 500}}
              axisLine={false}
              tickLine={false}
              dy={10}
              interval={axisInterval}
              angle={0}
              height={50}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              stroke="#9ca3af"
              tick={{fontSize: 12, fill: '#9ca3af', fontWeight: 500}}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
              width={85}
              dx={-5}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a0b0d', borderColor: '#3b82f6', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: '#3b82f6' }}
              labelFormatter={(label) => timeframe === '24H' ? `Time: ${label}` : `Date: ${label}`}
              formatter={(value) => [`$${safeNumber(value).toFixed(2)}`, 'Portfolio Value']}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default PerformanceChart;
