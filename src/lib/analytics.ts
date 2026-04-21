import { supabase } from './supabase';

export interface AnalyticsEvent {
  type: 'view' | 'button_click' | 'input_submit' | 'reached_cta';
  label?: string;
  timestamp: string;
  sessionId: string;
}

export interface ProjectAnalytics {
  projectId: string;
  events: AnalyticsEvent[];
  totalViews: number;
  totalClicks: number;
  totalConversions: number;
}

export async function trackAnalyticsEvent(projectId: string, flowName: string, event: AnalyticsEvent) {
  try {
    if (!projectId) {
      console.warn('Analytics: Missing projectId');
      return;
    }

    const slug = flowName
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

    const realProjectId = project?.id || projectId;

    if (!event.type) {
      console.warn('Analytics: Missing event type');
      return;
    }

    const sessionId = sessionStorage.getItem('zf_session_id') || crypto.randomUUID();
    sessionStorage.setItem('zf_session_id', sessionId);

    // Para evitar os logs vermelhos de 409 Conflict no console do navegador,
    // sempre verificamos se o evento já existe antes de tentar a inserção.
    let query = supabase
      .from('analytics_events')
      .select('id')
      .eq('session_id', sessionId)
      .eq('type', event.type)
      .eq('project_id', realProjectId);

    // Se o evento tem um label específico, filtramos por ele também
    if (event.label !== undefined && event.label !== null) {
      query = query.eq('label', event.label);
    }

    const { data: existing } = await query.limit(1);

    // Só insere se não houver NENHUM evento idêntico já salvo nesta sessão
    if (!existing || existing.length === 0) {
      const payload = {
        project_id: realProjectId,
        type: event.type,
        label: event.label || null,
        session_id: sessionId,
      };

      console.log('Analytics insert payload:', payload);

      const { data, error, status, statusText } = await supabase
        .from('analytics_events')
        .insert(payload);

      console.log('Analytics response:', { data, error, status, statusText });

      if (error) {
        console.error('Analytics error details:', JSON.stringify(error, null, 2));
      }
    }
  } catch (error) {
    console.warn('Analytics error:', error);
  }
}

export async function getAnalytics(projectId: string, startDate?: string, endDate?: string): Promise<ProjectAnalytics> {
  const defaultAnalytics: ProjectAnalytics = {
    projectId,
    events: [],
    totalViews: 0,
    totalClicks: 0,
    totalConversions: 0
  };

  if (!projectId) return defaultAnalytics;

  try {
    let query = supabase
      .from('analytics_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Erro ao buscar analytics na nuvem:', error);
      return defaultAnalytics;
    }

    if (!events) return defaultAnalytics;

    let totalViews = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    const mappedEvents: AnalyticsEvent[] = events.map(e => {
      if (e.type === 'view') totalViews++;
      if (e.type === 'button_click') totalClicks++;
      if (e.type === 'reached_cta') totalConversions++;

      return {
        type: e.type as any,
        label: e.label || undefined,
        sessionId: e.session_id,
        timestamp: e.created_at
      };
    });

    return {
      projectId,
      events: mappedEvents,
      totalViews,
      totalClicks,
      totalConversions
    };

  } catch (error) {
    console.error('Falha ao compilar analytics_events:', error);
    return defaultAnalytics;
  }
}
