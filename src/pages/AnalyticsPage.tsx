import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LayoutDashboard, Target, MessageSquare, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { getAnalytics, ProjectAnalytics } from '@/lib/analytics';
import { getProjects } from '@/lib/projectsService';
import { trackPresence } from '@/lib/presence';
import { AnalyticsCard } from '@/components/dashboard/AnalyticsCard';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, startOfMonth, endOfMonth, startOfToday, endOfToday, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type FilterType = 'today' | 'yesterday' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'custom';

const AnalyticsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectAnalytics | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(0);

  const [filterType, setFilterType] = useState<FilterType>(() => {
    return (localStorage.getItem('zf_analytics_filter') as FilterType) || '7d';
  });
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 7),
    end: new Date()
  });

  useEffect(() => {
    async function loadData() {
      if (projectId) {
        try {
          setIsLoading(true);
          let startDate = startOfToday();
          let endDate = endOfToday();
          const today = new Date();

          switch (filterType) {
             case 'today': break;
             case 'yesterday':
               startDate = subDays(startOfToday(), 1);
               endDate = subDays(endOfToday(), 1);
               break;
             case '7d':
               startDate = subDays(startOfToday(), 7);
               break;
             case '30d':
               startDate = subDays(startOfToday(), 30);
               break;
             case 'thisMonth':
               startDate = startOfMonth(today);
               break;
             case 'lastMonth':
               startDate = startOfMonth(subMonths(today, 1));
               endDate = endOfMonth(subMonths(today, 1));
               break;
             case 'custom':
               startDate = customDateRange.start;
               endDate = customDateRange.end;
               break;
          }

          localStorage.setItem('zf_analytics_filter', filterType);
          
          // 1. Busca os dados dos projetos (seja do Storage ou da API)
          const projectsData = await getProjects();
          const prj = projectsData?.find(p => p.id === projectId);
          let realProjectId = projectId;
          
          if (prj) {
            setProjectName(prj.name);
            const slug = prj.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
              
            const { data: project } = await supabase
              .from('projects')
              .select('id')
              .eq('slug', slug)
              .maybeSingle();
              
            realProjectId = project?.id || projectId;
          }

          const { data: projectTest } = await supabase
            .from('projects')
            .select('id')
            .eq('id', projectId)
            .maybeSingle();

          if (!projectTest) {
            const { data: projectBySlug } = await supabase
              .from('projects')
              .select('id, slug')
              .limit(10);
            console.log('Projetos disponíveis (debug):', projectBySlug);
          }

          console.log('Buscando analytics para project_id:', realProjectId, 'entre', startDate, 'e', endDate);

          const analyticsData = await getAnalytics(realProjectId, startDate.toISOString(), endDate.toISOString());
          setData(analyticsData);
        } catch (e) {
          console.error('Erro ao buscar analytics na nuvem:', e);
        } finally {
          setIsLoading(false);
        }
      }
    }
    loadData();
  }, [projectId, filterType, customDateRange]);

  useEffect(() => {
    if (!projectId) return;
    const cleanupPresence = trackPresence(projectId, false);
    
    const handlePresence = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.projectId === projectId) {
        setOnlineUsers(customEvent.detail.count);
      }
    };
    
    window.addEventListener('presence-update', handlePresence);
    return () => {
      window.removeEventListener('presence-update', handlePresence);
      cleanupPresence();
    };
  }, [projectId]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Carregando métricas da nuvem...</p>
      </div>
    );
  }

  // Analisar botões mais clicados
  const buttonClicks = data.events.filter(e => e.type === 'button_click');
  const btnStats = buttonClicks.reduce((acc, curr) => {
    const label = curr.label || 'Botão Desconhecido';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topButtons = Object.entries(btnStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const viewCount = data.totalViews || 1;
  const ctaRate = ((data.totalConversions / viewCount) * 100).toFixed(1);
  const clickRate = ((data.totalClicks / viewCount) * 100).toFixed(1);

  const eventsA = data.events.filter(e => e.abVariant === 'A' || !e.abVariant);
  const eventsB = data.events.filter(e => e.abVariant === 'B');
  
  const hasABTest = eventsB.length > 0;
  
  const statsA = {
    views: eventsA.filter(e => e.type === 'view').length,
    conversions: eventsA.filter(e => e.type === 'reached_cta').length,
  };
  const statsB = {
    views: eventsB.filter(e => e.type === 'view').length,
    conversions: eventsB.filter(e => e.type === 'reached_cta').length,
  };
  
  const rateA = statsA.views > 0 ? (statsA.conversions / statsA.views) * 100 : 0;
  const rateB = statsB.views > 0 ? (statsB.conversions / statsB.views) * 100 : 0;
  
  let winnerText = 'Empate';
  if (rateA > rateB && rateA > 0) winnerText = `Variante A (+${(rateA - rateB).toFixed(1)}% de conversão)`;
  else if (rateB > rateA && rateB > 0) winnerText = `Variante B (+${(rateB - rateA).toFixed(1)}% de conversão)`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="-ml-2 shrink-0">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Analytics</h1>
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground font-medium">{projectName || 'Projeto Desconhecido'}</p>
              {onlineUsers > 0 && (
                <div className="flex items-center gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full text-xs font-semibold animate-in fade-in zoom-in">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  {onlineUsers} {onlineUsers === 1 ? 'pessoa' : 'pessoas'} no funil agora
                </div>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/builder/${projectId}`)}>
          <LayoutDashboard className="w-4 h-4 mr-2" />
          Ir para o Construtor
        </Button>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Painel Central Reutilizando o Componente */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2 bg-card p-4 rounded-lg border border-border">
           <h2 className="text-xl font-semibold tracking-tight">Visão Geral</h2>
           <div className="flex flex-wrap items-center gap-2">
             <Select value={filterType} onValueChange={(val: any) => setFilterType(val)}>
               <SelectTrigger className="w-[180px] bg-background">
                 <SelectValue placeholder="Período" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="today">Hoje</SelectItem>
                 <SelectItem value="yesterday">Ontem</SelectItem>
                 <SelectItem value="7d">Últimos 7 dias</SelectItem>
                 <SelectItem value="30d">Últimos 30 dias</SelectItem>
                 <SelectItem value="thisMonth">Este mês</SelectItem>
                 <SelectItem value="lastMonth">Mês passado</SelectItem>
                 <SelectItem value="custom">Personalizado</SelectItem>
               </SelectContent>
             </Select>
             
             {filterType === 'custom' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[240px] justify-start text-left font-normal bg-background">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateRange.start ? (
                        customDateRange.end ? (
                          <>
                            {format(customDateRange.start, "dd/MM/yyyy")} - {format(customDateRange.end, "dd/MM/yyyy")}
                          </>
                        ) : (
                          format(customDateRange.start, "dd/MM/yyyy")
                        )
                      ) : (
                        <span>Selecione a data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={customDateRange.start}
                      selected={{ from: customDateRange.start, to: customDateRange.end }}
                      onSelect={(range) => {
                         if (range) {
                           setCustomDateRange({ start: range.from!, end: range.to || range.from! });
                         }
                      }}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
             )}
           </div>
        </div>

        <AnalyticsCard data={data!} />

        {/* Detalhamento Estendido */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">Botões mais clicados</h3>
            </div>
            {topButtons.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum clique registrado ainda.</p>
            ) : (
              <div className="space-y-4 relative">
                {topButtons.map(([label, count]) => {
                  const pct = `${(count / data.totalClicks) * 100}%`;
                  return (
                    <div key={label} className="relative z-10">
                      <div className="flex justify-between text-sm font-medium mb-1 relative z-10 px-2 pt-1">
                        <span className="truncate pr-4" title={label}>{label}</span>
                        <span className="shrink-0">{count} vezes</span>
                      </div>
                      <div className="absolute top-0 left-0 h-full bg-primary/10 rounded-md -z-10" style={{ width: pct }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">Performance de Funil</h3>
            </div>
            
            <div className="space-y-6 mt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 text-right">
                  <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-1 rounded">100%</span>
                </div>
                <div className="flex-1">
                  <div className="h-6 w-full bg-primary/20 rounded-md border border-primary/30 relative overflow-hidden">
                     <div className="absolute top-0 left-0 h-full w-full bg-primary/40" />
                  </div>
                </div>
                <div className="w-24 text-sm text-muted-foreground font-medium">Visualizou</div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 text-right">
                  <span className="text-xs font-bold text-foreground">{clickRate}%</span>
                </div>
                <div className="flex-1">
                  <div className="h-6 w-full bg-muted rounded-md relative overflow-hidden">
                     <div className="absolute top-0 left-0 h-full bg-primary/60 rounded-md" style={{ width: `${clickRate}%` }} />
                  </div>
                </div>
                <div className="w-24 text-sm text-muted-foreground font-medium">Interagiu</div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 text-right">
                  <span className="text-xs font-bold text-primary">{ctaRate}%</span>
                </div>
                <div className="flex-1">
                  <div className="h-6 w-full bg-muted rounded-md relative overflow-hidden">
                     <div className="absolute top-0 left-0 h-full bg-primary rounded-md" style={{ width: `${ctaRate}%` }} />
                  </div>
                </div>
                <div className="w-24 text-sm font-semibold text-primary">Conversão</div>
              </div>
            </div>
          </div>

          {hasABTest && (
            <div className="bg-card border border-border rounded-lg p-5 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-base font-semibold">Resultados do Teste A/B</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-secondary/50 p-4 rounded-lg flex flex-col justify-center">
                  <span className="font-semibold text-foreground text-lg mb-1">Variante A</span>
                  <span className="text-muted-foreground">{statsA.views} views, {statsA.conversions} conversões</span>
                  <span className="text-primary font-bold mt-1 text-xl">{rateA.toFixed(1)}%</span>
                </div>
                <div className="bg-secondary/50 p-4 rounded-lg flex flex-col justify-center">
                  <span className="font-semibold text-foreground text-lg mb-1">Variante B</span>
                  <span className="text-muted-foreground">{statsB.views} views, {statsB.conversions} conversões</span>
                  <span className="text-primary font-bold mt-1 text-xl">{rateB.toFixed(1)}%</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="font-semibold text-foreground">Vencedor Atual:</span>
                <span className="font-bold text-primary text-lg">{winnerText}</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AnalyticsPage;
