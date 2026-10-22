import { AI_MODE } from "../../pokemon/aiModes.js";

export const MODE_ICONS = {
  [AI_MODE.DEFAULT]:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
  [AI_MODE.STAY]:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor"/></svg>',
  [AI_MODE.FOLLOW]:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="12" r="4.3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16.5" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  [AI_MODE.DEFEND]:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l7 2.8v5c0 4.4-3 7.4-7 8.9-4-1.5-7-4.5-7-8.9v-5l7-2.8z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  [AI_MODE.AUTO_HUNT]:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="15" y1="15" x2="20.5" y2="20.5" stroke="currentColor" stroke-width="1.6"/></svg>',
  [AI_MODE.AGRO]:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="12" y1="1.5" x2="12" y2="4.8" stroke="currentColor" stroke-width="1.6"/><line x1="12" y1="19.2" x2="12" y2="22.5" stroke="currentColor" stroke-width="1.6"/><line x1="1.5" y1="12" x2="4.8" y2="12" stroke="currentColor" stroke-width="1.6"/><line x1="19.2" y1="12" x2="22.5" y2="12" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/></svg>',
};
