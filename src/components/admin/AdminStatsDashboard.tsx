import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActivitySeries } from "@/lib/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export function AdminStatsDashboard() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity", days],
    queryFn: () => getActivitySeries(days),
  });

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" /> Activité
        </CardTitle>
        <div className="flex gap-1">
          {[30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setDays(d)}
            >
              {d} j
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid h-56 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <LineChart data={data ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip labelFormatter={(l) => fmt(l as string)} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="interventions" name="Comptes-rendus" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="clients" name="Clients" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
