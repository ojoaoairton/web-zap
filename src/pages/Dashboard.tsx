import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Plus, Copy, Trash2, Edit2, Play, Search, BarChart3, Eye, MousePointerClick, ShoppingCart, Loader2 } from 'lucide-react';
import { Project } from '@/types/project';
import { getProjects, createProject, duplicateProject, deleteProject } from '@/lib/projectsService';
import { getAnalytics } from '@/lib/analytics';
import { trackPresence } from '@/lib/presence';
import { toast } from 'sonner';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [projectMetrics, setProjectMetrics] = useState<Record<string, any>>({});
  const [onlineCounts, setOnlineCounts] = useState<Record<string, number>>({});

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const data = await getProjects();
      const allProjects = data || [];
      setProjects(allProjects);

      // Carregar analytics assincronamente para todos os projetos
      if (allProjects.length > 0) {
        const metricsMap: Record<string, any> = {};
        await Promise.all(allProjects.map(async (p) => {
          metricsMap[p.id] = await getAnalytics(p.id);
        }));
        setProjectMetrics(metricsMap);
      }

    } catch (e: any) {
      toast.error('Erro ao carregar projetos da nuvem: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    
    // Conectar presença p/ todos os projetos como ouvintes passivos (isViewer = false)
    const cleanups = projects.map(p => trackPresence(p.id, false));
    
    const handlePresence = (e: Event) => {
      const customEvent = e as CustomEvent;
      setOnlineCounts(prev => ({
        ...prev,
        [customEvent.detail.projectId]: customEvent.detail.count
      }));
    };
    
    window.addEventListener('presence-update', handlePresence);
    return () => {
      window.removeEventListener('presence-update', handlePresence);
      cleanups.forEach(c => c());
    }
  }, [projects]);

  const handleNewProject = async () => {
    const name = window.prompt("Nome do novo projeto:", "Meu Novo Fluxo");
    if (name) {
      try {
        const id = await createProject(name);
        navigate(`/builder/${id}`);
      } catch (e: any) {
        toast.error('Erro ao criar projeto: ' + e.message);
      }
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const newId = await duplicateProject(id);
      if (newId) {
        toast.success('Projeto duplicado!');
        loadProjects();
      }
    } catch (e: any) {
      toast.error('Erro ao duplicar: ' + e.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir "${name}"?`)) {
      try {
        await deleteProject(id);
        toast.success('Projeto excluído com sucesso');
        loadProjects();
      } catch (e: any) {
        toast.error('Erro ao excluir: ' + e.message);
      }
    }
  };
  
  const handleEdit = (id: string) => {
    navigate(`/builder/${id}`);
  };

  const handleAnalytics = (id: string) => {
    navigate(`/analytics/${id}`);
  };

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.flow?.name && p.flow.name.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shadow-sm">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">ZaperFlux</h1>
        </div>
        <Button onClick={handleNewProject} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Projeto
        </Button>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Seus Projetos</h2>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar projetos..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-64 transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
             <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
             <p>Sincronizando com a nuvem...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed border-border">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum projeto encontrado</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              Crie seu primeiro funil de vendas e comece a capturar leads agora mesmo.
            </p>
            <Button onClick={handleNewProject}>
              <Plus className="w-4 h-4 mr-2" />
              Criar meu primeiro projeto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects.map((project) => {
              const metrics = projectMetrics[project.id] || { totalViews: 0, totalClicks: 0, totalConversions: 0 };
              return (
              <Card key={project.id} className="overflow-hidden flex flex-col hover:border-primary/50 transition-colors group">
                <div className="h-32 bg-[var(--bg-overlay,hsl(var(--muted)/0.5))] relative flex items-center justify-center p-4" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url(https://static.whatsapp.net/rsrc.php/v4/y1/r/a3pd-CgpXeU.png)', backgroundSize: '150px auto' }}>
                   {project.flow?.avatarUrl ? (
                     <img src={project.flow.avatarUrl} alt="Avatar" className="w-14 h-14 rounded-full border-2 border-primary ring-2 ring-background z-10 object-cover" />
                   ) : (
                     <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center border-2 border-background ring-2 ring-background z-10 shadow-lg">
                       <MessageCircle className="w-7 h-7 text-primary-foreground" />
                     </div>
                   )}
                   <div className="absolute bottom-2 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full z-10 border border-white/10">
                     <Play className="w-3 h-3 text-white" />
                     <span className="text-[10px] text-white font-medium">{project.flow?.blocks?.length || 0} blocos</span>
                   </div>
                </div>
                
                <CardContent className="p-4 flex-1">
                  <CardTitle className="text-base mb-2 truncate" title={project.name}>{project.name}</CardTitle>
                  
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground/80 font-medium bg-muted/20 p-2 rounded-md">
                    <div className="flex items-center gap-1" title="Visualizações">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{metrics.totalViews}</span>
                    </div>
                    <div className="flex items-center gap-1" title="Cliques">
                      <MousePointerClick className="w-3.5 h-3.5" />
                      <span>{metrics.totalClicks}</span>
                    </div>
                    <div className="flex items-center gap-1" title="Conversões">
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{metrics.totalConversions}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <CardDescription className="text-[10px]">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </CardDescription>

                    {onlineCounts[project.id] > 0 && (
                      <div className="flex items-center gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full text-[10px] font-semibold animate-in fade-in zoom-in">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                        </span>
                        {onlineCounts[project.id]} online agora
                      </div>
                    )}
                  </div>
                </CardContent>
                
                <CardFooter className="p-3 bg-muted/30 border-t border-border flex justify-between gap-1 overflow-x-auto transition-opacity focus-within:opacity-100">
                  <Button variant="secondary" size="sm" className="flex-1 h-8 text-xs font-medium px-2" onClick={() => handleEdit(project.id)}>
                    <Edit2 className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0" title="Ver Analytics" onClick={() => handleAnalytics(project.id)}>
                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0" title="Duplicar" onClick={() => handleDuplicate(project.id)}>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0 hover:border-destructive hover:bg-destructive/10 hover:text-destructive" title="Excluir" onClick={() => handleDelete(project.id, project.name)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
