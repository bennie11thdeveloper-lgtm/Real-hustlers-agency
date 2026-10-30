import { useEffect, useState } from 'react';
import { defaultSiteContent, normalizeSiteContent } from './content.js';
import { supabase } from './lib/supabase.js';

export function useSiteContent() {
  const [content, setContent] = useState(defaultSiteContent);

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    let updateVersion = 0;
    let pollingTimer;

    function startFallbackPolling() {
      if (active && !pollingTimer) {
        pollingTimer = window.setInterval(loadContent, 15000);
      }
    }

    async function loadContent() {
      const requestVersion = updateVersion;
      const { data, error } = await supabase
        .from('site_content')
        .select('content')
        .eq('id', 'public')
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error('Could not load published website content; showing the built-in copy.', error.message);
        return;
      }
      if (data?.content && requestVersion === updateVersion) {
        setContent(normalizeSiteContent(data.content));
      }
    }

    loadContent();
    const channel = supabase
      .channel('published-site-content')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'site_content', filter: 'id=eq.public' },
        (payload) => {
          if (!active || !payload.new?.content) return;
          updateVersion += 1;
          setContent(normalizeSiteContent(payload.new.content));
        },
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          window.clearInterval(pollingTimer);
          pollingTimer = undefined;
          loadContent();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('Could not subscribe to published website updates.', error?.message ?? status);
          loadContent();
          startFallbackPolling();
        }
      });

    return () => {
      active = false;
      window.clearInterval(pollingTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  return content;
}
