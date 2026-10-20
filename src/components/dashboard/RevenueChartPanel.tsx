import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  ShoppingBag,
  ArrowUpRight,
  BarChart3,
  Layers,
} from 'lucide-react';
import { Order } from '../../types/finance';
import { formatCurrency, formatPercent } from '../../utils/pricing';

interface RevenueChartPanelProps {
  orders: Order[];
  onNavigateToOrders: () => void;
  selectedMarketplace?: string;
}

type PeriodFilter = '7d' | '15d' | '30d' | '90d' | 'year' | 'all';

export const RevenueChartPanel: React.FC<RevenueChartPanelProps> = ({
  orders,
  onNavigateToOrders,
  selectedMarketplace = 'todos',
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    total: number;
    count: number;
    formattedDate: string;
  } | null>(null);

  // Filter orders by marketplace if specified
  const marketplaceOrders = useMemo(() => {
    if (!selectedMarketplace || selectedMarketplace === 'todos') {
      return orders;
    }
    return orders.filter((o) => o.marketplace === selectedMarketplace);
  }, [orders, selectedMarketplace]);

  // Compute cutoff date based on period
  const { filteredOrders, periodLabel, daysCount } = useMemo(() => {
    const now = new Date();
    let days = 30;
    let label = 'Últimos 30 dias';

    if (period === '7d') {
      days = 7;
      label = 'Últimos 7 dias';
    } else if (period === '15d') {
      days = 15;
      label = 'Últimos 15 dias';
    } else if (period === '30d') {
      days = 30;
      label = 'Últimos 30 dias';
    } else if (period === '90d') {
      days = 90;
      label = 'Últimos 90 dias';
    } else if (period === 'year') {
      days = 365;
      label = 'Ano Atual';
    } else if (period === 'all') {
      days = 1000;
      label = 'Todo o Histórico';
    }

    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const res =
      period === 'all'
        ? marketplaceOrders
        : marketplaceOrders.filter((o) => o.saleDate >= cutoffStr);

    return { filteredOrders: res, periodLabel: label, daysCount: days };
  }, [marketplaceOrders, period]);

  // Calculate summary metrics for the period
  const metrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((acc, curr) => acc + curr.grossAmount, 0);
    const totalOrders = filteredOrders.length;
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Estimate profit for this period
    let totalCost = 0;
    let totalFees = 0;
    filteredOrders.forEach((o) => {
      totalFees += o.knownFeesAmount;
      o.items.forEach((i) => {
        totalCost += i.totalCost;
      });
    });
    const estimatedPeriodProfit = Math.max(0, totalRevenue - totalFees - totalCost);
    const profitMargin = totalRevenue > 0 ? (estimatedPeriodProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalOrders,
      avgTicket,
      estimatedPeriodProfit,
      profitMargin,
    };
  }, [filteredOrders]);

  // Group orders by date for time-series chart
  const chartData = useMemo(() => {
    const now = new Date();
    const dateMap: Record<string, { total: number; count: number }> = {};

    // For 7d, 15d, 30d: build every single day entry to give a continuous timeline
    if (daysCount <= 30) {
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = d.toISOString().split('T')[0];
        dateMap[key] = { total: 0, count: 0 };
      }
    }

    filteredOrders.forEach((ord) => {
      const key = ord.saleDate;
      if (!dateMap[key]) {
        dateMap[key] = { total: 0, count: 0 };
      }
      dateMap[key].total += ord.grossAmount;
      dateMap[key].count += 1;
    });

    const sortedDates = Object.keys(dateMap).sort();
    return sortedDates.map((d) => {
      const parts = d.split('-');
      const formattedDate = `${parts[2]}/${parts[1]}`;
      return {
        date: d,
        formattedDate,
        total: dateMap[d].total,
        count: dateMap[d].count,
      };
    });
  }, [filteredOrders, daysCount]);

  // SVG Chart Dimensions & Geometry
  const maxTotal = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.total), 0);
    return max > 0 ? max * 1.15 : 100;
  }, [chartData]);

  const chartHeight = 160;
  const chartWidth = 500;
  const paddingX = 24;
  const paddingY = 20;

  // Build points for SVG path
  const points = useMemo(() => {
    if (chartData.length === 0) return [];
    const step =
      chartData.length > 1
        ? (chartWidth - paddingX * 2) / (chartData.length - 1)
        : chartWidth / 2;

    return chartData.map((d, idx) => {
      const x = paddingX + idx * step;
      const y =
        chartHeight - paddingY - (d.total / maxTotal) * (chartHeight - paddingY * 2);
      return { ...d, x, y };
    });
  }, [chartData, maxTotal]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const bottomY = chartHeight - paddingY;
    return `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [pathD, points]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between h-full">
      {/* Top Header & Period Filter Controls */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#064E3B] flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Evolução do Faturamento
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 ml-9">
              Receita e volume de vendas reais registradas no período.
            </p>
          </div>

          {/* Period selector buttons */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setPeriod('7d')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                period === '7d'
                  ? 'bg-white text-[#064E3B] shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriod('15d')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                period === '15d'
                  ? 'bg-white text-[#064E3B] shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              15 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriod('30d')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                period === '30d'
                  ? 'bg-white text-[#064E3B] shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              30 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriod('90d')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                period === '90d'
                  ? 'bg-white text-[#064E3B] shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              90 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                period === 'all'
                  ? 'bg-white text-[#064E3B] shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              Tudo
            </button>
          </div>
        </div>

        {/* Highlighted Period Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
              Faturamento ({periodLabel})
            </span>
            <p className="text-lg sm:text-xl font-extrabold font-mono text-[#064E3B] mt-1 tabular-nums">
              {formatCurrency(metrics.totalRevenue)}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Pedidos Realizados
            </span>
            <p className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 mt-1 tabular-nums">
              {metrics.totalOrders} {metrics.totalOrders === 1 ? 'pedido' : 'pedidos'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Ticket Médio
            </span>
            <p className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 mt-1 tabular-nums">
              {formatCurrency(metrics.avgTicket)}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Margem Média Est.
            </span>
            <p className="text-lg sm:text-xl font-extrabold font-mono text-emerald-700 mt-1 tabular-nums">
              {formatPercent(metrics.profitMargin)}
            </p>
          </div>
        </div>

        {/* Visual Chart Area */}
        <div className="relative pt-2 pb-1">
          {filteredOrders.length === 0 ? (
            <div className="py-12 px-4 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
              <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">
                Nenhuma venda registrada em {periodLabel.toLowerCase()}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Altere o filtro de período ou adicione um novo pedido no sistema.
              </p>
              <button
                type="button"
                onClick={onNavigateToOrders}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#064E3B] text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Registrar venda</span>
              </button>
            </div>
          ) : (
            <div className="w-full overflow-hidden">
              {/* Active hover tooltip */}
              {hoveredPoint && (
                <div className="mb-2 p-2 bg-slate-900 text-white rounded-lg text-xs flex items-center justify-between shadow-md">
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      Data: {hoveredPoint.formattedDate}
                    </span>
                    <span className="font-bold font-mono">
                      {formatCurrency(hoveredPoint.total)}
                    </span>
                  </div>
                  <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-medium">
                    {hoveredPoint.count} {hoveredPoint.count === 1 ? 'pedido' : 'pedidos'}
                  </span>
                </div>
              )}

              {/* Responsive SVG */}
              <div className="relative w-full h-44">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  <line
                    x1={paddingX}
                    y1={paddingY}
                    x2={chartWidth - paddingX}
                    y2={paddingY}
                    stroke="#E2E8F0"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={paddingX}
                    y1={(chartHeight - paddingY * 2) / 2 + paddingY}
                    x2={chartWidth - paddingX}
                    y2={(chartHeight - paddingY * 2) / 2 + paddingY}
                    stroke="#E2E8F0"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={paddingX}
                    y1={chartHeight - paddingY}
                    x2={chartWidth - paddingX}
                    y2={chartHeight - paddingY}
                    stroke="#CBD5E1"
                  />

                  {/* Shaded Area */}
                  {areaD && <path d={areaD} fill="url(#revenueGradient)" />}

                  {/* Line Path */}
                  {pathD && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Interactive Points */}
                  {points.map((pt, idx) => (
                    <g key={pt.date + idx}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={pt.total > 0 ? 4 : 2}
                        className={`transition-all cursor-pointer ${
                          pt.total > 0
                            ? 'fill-[#064E3B] stroke-white stroke-2 hover:r-6'
                            : 'fill-slate-300'
                        }`}
                        onMouseEnter={() =>
                          setHoveredPoint({
                            date: pt.date,
                            formattedDate: pt.formattedDate,
                            total: pt.total,
                            count: pt.count,
                          })
                        }
                      />
                    </g>
                  ))}
                </svg>
              </div>

              {/* Bottom dates axis */}
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1 px-2">
                <span>{points[0]?.formattedDate || ''}</span>
                {points.length > 2 && (
                  <span>{points[Math.floor(points.length / 2)]?.formattedDate || ''}</span>
                )}
                <span>{points[points.length - 1]?.formattedDate || ''}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom link to detailed orders */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">
          Dados sincronizados em tempo real com seus pedidos
        </span>
        <button
          type="button"
          onClick={onNavigateToOrders}
          className="font-bold text-[#064E3B] hover:underline flex items-center gap-1"
        >
          <span>Ver vendas detalhadas</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
