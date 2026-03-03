import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  trend?: number
  icon?: React.ReactNode
}

export function MetricCard({ title, value, trend, icon }: MetricCardProps) {
  const isPositive = trend !== undefined && trend > 0

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground h-4 w-4">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {trend !== undefined && (
          <p className="text-xs mt-1 flex items-center gap-1">
            <span
              className={`flex items-center font-medium ${
                isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {isPositive ? (
                <ArrowUpIcon className="w-3 h-3 mr-0.5" />
              ) : (
                <ArrowDownIcon className="w-3 h-3 mr-0.5" />
              )}
              {Math.abs(trend)}%
            </span>
            <span className="text-muted-foreground">vs last month</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

