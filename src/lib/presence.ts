import { supabase } from './supabase';

export function trackPresence(projectId: string, isViewer = true) {
  const channel = supabase.channel('presence:' + projectId);
  
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      // Disparar evento customizado com count
      window.dispatchEvent(
        new CustomEvent('presence-update', { 
          detail: { projectId, count } 
        })
      );
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && isViewer) {
        await channel.track({ 
          projectId,
          online_at: new Date().toISOString() 
        });
      }
    });

  return () => supabase.removeChannel(channel);
}
