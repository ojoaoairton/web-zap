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

export async function trackAnalyticsEvent(projectId: string, event: AnalyticsEvent) {
  if (!projectId) return;

  const sessionId = sessionStorage.getItem('zf_session') || crypto.randomUUID();
  sessionStorage.setItem('zf_session', sessionId);

  try {
    const payload = {
      project_id: projectId,
      type: event.type,
      label: event.label,
      session_id: sessionId,
      created_at: event.timestamp || new Date().toISOString()
    };

    if (event.type === 'view') {
      const existing = await supabase
        .from('analytics_events')
        .select('id')
        .eq('session_id', sessionId)
        .eq('type', 'view')
        .eq('project_id', projectId)
        .maybeSingle();

      if (!existing.data) {
        await supabase.from('analytics_events').insert(payload);
      }
    } else {
      await supabase.from('analytics_events').upsert(payload, { onConflict: 'id' });
    }
  } catch (error) {
    console.warn('Analytics error:', error);
  }
}

export async function getAnalytics(projectId: string): Promise<ProjectAnalytics> {
  const defaultAnalytics: ProjectAnalytics = {
    projectId,
    events: [],
    totalViews: 0,
    totalClicks: 0,
    totalConversions: 0
  };

  if (!projectId) return defaultAnalytics;

  try {
    const { data: events, error } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1000);

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
