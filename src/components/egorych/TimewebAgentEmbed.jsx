import { useEffect } from 'react';

const AGENT_SCRIPT_ID = 'timeweb-egorych-embed';
const AGENT_SRC =
  'https://timeweb.cloud/api/v1/cloud-ai/agents/61d8fa49-343e-4c5a-b81d-5a03876d0f57/embed.js?collapsed=true';

/**
 * Loads Timeweb Cloud AI agent widget (Егорыч).
 * @see https://timeweb.cloud/docs/ai-agents/manage-agents/embed-chatbots
 */
export default function TimewebAgentEmbed() {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (document.getElementById(AGENT_SCRIPT_ID)) return undefined;

    const script = document.createElement('script');
    script.id = AGENT_SCRIPT_ID;
    script.src = AGENT_SRC;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Leave script in place while navigating away so the widget can reopen
      // quickly if the user returns to Егорыч. Full unload clears on page reload.
    };
  }, []);

  return null;
}
