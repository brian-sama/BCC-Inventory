const DEFAULT_STREAMLIT_URL = 'https://bcc-inventorygit-wy45nc9x6hlkvdvs8xqovp.streamlit.app/';

const getConfiguredStreamlitUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_STREAMLIT_URL;
  const rawUrl = typeof envUrl === 'string' && envUrl.trim() ? envUrl.trim() : DEFAULT_STREAMLIT_URL;
  return rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`;
};

export const STREAMLIT_URL = getConfiguredStreamlitUrl();

export const STREAMLIT_EMBED_URL = (() => {
  const url = new URL(STREAMLIT_URL);
  url.searchParams.set('embed', 'true');
  return url.toString();
})();
