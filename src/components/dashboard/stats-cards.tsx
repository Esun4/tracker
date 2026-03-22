import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, TrendingUp, BarChart3, XCircle } from "lucide-react";

interface StatsCardsProps {
  stats: {
    total: number;
    byStatus: Record<string, number>;
    interviewRate: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const active =
    stats.total -
    (stats.byStatus.REJECTED || 0) -
    (stats.byStatus.WITHDRAWN || 0) -
    (stats.byStatus.OFFER || 0);

  const interviews =
    (stats.byStatus.INTERVIEW || 0) +
    (stats.byStatus.FINAL_ROUND || 0);

  const rejections = stats.byStatus.REJECTED || 0;

  const cards = [
    {
      title: "Total Applications",
      value: stats.total.toString(),
      icon: Briefcase,
    },
    {
      title: "Active",
      value: active.toString(),
      icon: BarChart3,
    },
    {
      title: "Interviews",
      value: interviews.toString(),
      icon: TrendingUp,
    },
    {
      title: "Rejections",
      value: rejections.toString(),
      icon: XCircle,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
