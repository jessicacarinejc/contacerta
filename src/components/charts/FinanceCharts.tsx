import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { compactCurrency, toCurrency } from '../../lib/currency';

const history = [
  { month: 'Mar', income: 22400, expense: 15400, result: 7000, balance: 11800 },
  { month: 'Abr', income: 23500, expense: 17200, result: 6300, balance: 12400 },
  { month: 'Mai', income: 24800, expense: 16800, result: 8000, balance: 14100 },
  { month: 'Jun', income: 23100, expense: 18100, result: 5000, balance: 15200 },
  { month: 'Jul', income: 25700, expense: 17900, result: 7800, balance: 16900 },
  { month: 'Ago', income: 27450, expense: 15230, result: 12220, balance: 18750 },
];

const formatTooltipValue = (value: unknown) =>
  toCurrency(Number(Array.isArray(value) ? (value[0] ?? 0) : (value ?? 0)));

export function IncomeExpenseChart() {
  return (
    <div className="chart-box chart-large">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={history}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value) => compactCurrency.format(value)} />
          <Tooltip formatter={(value) => formatTooltipValue(value)} />
          <Legend />
          <Bar dataKey="income" name="Receitas" fill="#16a567" />
          <Bar dataKey="expense" name="Despesas" fill="#ef5656" />
          <Line type="monotone" dataKey="result" name="Resultado" stroke="#2674d9" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceChart() {
  return (
    <div className="chart-box chart-medium">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value) => compactCurrency.format(value)} />
          <Tooltip formatter={(value) => formatTooltipValue(value)} />
          <Area
            type="monotone"
            dataKey="balance"
            name="Saldo"
            stroke="#16a567"
            fill="#dff5e9"
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
