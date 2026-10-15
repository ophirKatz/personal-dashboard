import { LineChart as LineChartIcon } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, parseISO } from 'date-fns'
import { formatMoneyCompact, formatMoneyRounded } from './wealth'
import type { NetWorthPoint } from './wealth'

type Props = {
  series: NetWorthPoint[]
}

export default function NetWorthChart({ series }: Props) {
  // A trend needs at least two dated points; one is just the headline number.
  if (series.length < 2) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <LineChartIcon className="mx-auto mb-3 h-10 w-10" />
        <p className="font-medium">Your trend shows up once you've updated balances on two different days</p>
      </div>
    )
  }

  const spansYears = series[0].date.slice(0, 4) !== series[series.length - 1].date.slice(0, 4)
  const tickFormat = (d: string) => format(parseISO(d), spansYears ? "MMM ''yy" : 'MMM d')

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border bg-card p-3 pr-4">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormat}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={formatMoneyCompact}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(value: number) => [formatMoneyRounded(value), 'Total']}
              labelFormatter={(d: string) => format(parseISO(d), 'MMM d, yyyy')}
              contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        All values are shown at today's exchange rates. A step up can also mean an account was added.
      </p>
    </div>
  )
}
