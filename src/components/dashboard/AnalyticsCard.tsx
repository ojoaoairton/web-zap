import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ProjectAnalytics } from '@/lib/analytics';
import { Eye, MousePointerClick, ShoppingCart, Percent } from 'lucide-react';

interface Props {
  data: ProjectAnalytics;
}

export const AnalyticsCard: React.FC<Props> = ({ data }) => {
  const rate = data.totalViews > 0 
    ? ((data.totalConversions / data.totalViews) * 100).toFixed(1)
    : '0.0';

  // Gerar gráfico dos últimos 7 dias
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const viewsPerDay = last7Days.map(dayStr => {
    return data.events.filter(e => e.type === 'view' && e.timestamp.startsWith(dayStr)).length;
  });

  const maxViews = Math.max(...viewsPerDay, 1); // evita divisão por zero

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Visão Geral</CardTitle>
        <CardDescription>Métricas de funil do seu projeto</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center text-muted-foreground mb-2">
              <Eye className="w-4 h-4 mr-2" />
              <span className="text-xs font-medium">Visualizações</span>
            </div>
            <span className="text-2xl font-bold">{data.totalViews}</span>
          </div>
          
          <div className="flex flex-col gap-1 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center text-muted-foreground mb-2">
              <MousePointerClick className="w-4 h-4 mr-2" />
              <span className="text-xs font-medium">Cliques</span>
            </div>
            <span className="text-2xl font-bold">{data.totalClicks}</span>
          </div>

          <div className="flex flex-col gap-1 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center text-muted-foreground mb-2">
              <ShoppingCart className="w-4 h-4 mr-2" />
              <span className="text-xs font-medium">Conversões (Fim)</span>
            </div>
            <span className="text-2xl font-bold">{data.totalConversions}</span>
          </div>

          <div className="flex flex-col gap-1 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center text-primary mb-2">
              <Percent className="w-4 h-4 mr-2" />
              <span className="text-xs font-medium">Taxa de Conversão</span>
            </div>
            <span className="text-2xl font-bold text-primary">{rate}%</span>
          </div>
        </div>

        {/* Gráfico Simples */}
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium mb-4 text-muted-foreground">Acessos nos últimos 7 dias</h4>
          <div className="h-32 flex items-end justify-between gap-2 px-1">
            {last7Days.map((day, ix) => {
              const count = viewsPerDay[ix];
              const heightPercent = `${(count / maxViews) * 100}%`;
              const shortDate = day.split('-').slice(1).reverse().join('/'); // DD/MM
              
              return (
                <div key={day} className="flex flex-col items-center gap-2 flex-1 group">
                  <div className="w-full relative h-24 bg-muted/20 rounded-sm flex items-end justify-center">
                    <div 
                      className="w-full bg-primary/80 rounded-sm group-hover:bg-primary transition-all relative"
                      style={{ height: heightPercent, minHeight: count > 0 ? '4px' : '0' }}
                    >
                      {/* Tooltip nativo (CSS hover via group) */}
                      {count > 0 && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow text-center opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 border border-border">
                          {count} views
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{shortDate}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
