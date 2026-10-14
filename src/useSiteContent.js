import { useEffect, useState } from 'react';
import { defaultSiteContent } from './content.js';
import { supabase } from './lib/supabase.js';

export function useSiteContent() {
  const [content, setContent] = useState(defaultSiteContent);

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    async function loadContent() {
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
      if (data?.content) setContent(data.content);
    }

    loadContent();
    return () => { active = false; };
  }, []);

  return content;
}
