import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { compactCurrency, toCurrency } from '../../lib/currency';
import type { MonthlyFinanceSummary } from '../../lib/dashboard-history';

const formatTooltipValue = (value: unknown) =>
  toCurrency(Number(Array.isArray(value) ? (value[0] ?? 0) : (value ?? 0)));

function ChartEmptyState() {
  return (
    <div className="chart-empty-state" role="status">
      <strong>Seu histórico começa aqui</strong>
      <span>Registre ou importe movimentações para visualizar a evolução financeira.</span>
    </div>
  );
}

export function IncomeExpenseChart({ data }: { data: MonthlyFinanceSummary[] }) {
  if (!data.some((item) => item.income !== 0 || item.expense !== 0)) {
    return <ChartEmptyState />;
  }

  return (
    <div className="chart-box chart-large">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={5}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(value) => compactCurrency.format(value)} tickLine={false} axisLine={false} width={54} />
          <Tooltip formatter={(value) => formatTooltipValue(value)} />
          <Legend />
          <Bar dataKey="income" name="Receitas" fill="#279b48" radius={[5, 5, 0, 0]} maxBarSize={30} />
          <Bar dataKey="expense" name="Despesas" fill="#e95454" radius={[5, 5, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceChart({ data }: { data: MonthlyFinanceSummary[] }) {
  if (!data.some((item) => item.income !== 0 || item.expense !== 0)) {
    return <ChartEmptyState />;
  }

  return (
    <div className="chart-box chart-medium">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="resultGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#279b48" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#279b48" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(value) => compactCurrency.format(value)} tickLine={false} axisLine={false} width={54} />
          <Tooltip formatter={(value) => formatTooltipValue(value)} />
          <Area
            type="monotone"
            dataKey="result"
            name="Resultado do mês"
            stroke="#279b48"
            strokeWidth={2.5}
            fill="url(#resultGradient)"
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({
  data,
}: {
  data: Array<{ name: string; color: string; value: number }>;
}) {
  if (data.length === 0) {
    return <ChartEmptyState />;
  }

  return (
    <div className="category-chart-wrap">
      <div className="chart-box chart-donut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="82%">
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatTooltipValue(value)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="category-legend">
        {data.slice(0, 7).map((item) => (
          <div key={item.name}>
            <span style={{ background: item.color }} />
            <strong>{item.name}</strong>
            <em>{toCurrency(item.value)}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
