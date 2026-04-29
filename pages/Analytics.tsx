import React from 'react';
import { STREAMLIT_EMBED_URL, STREAMLIT_URL } from '../services/streamlitConfig';

const Analytics: React.FC = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-civic-text dark:text-white">📊 Asset Intelligence Dashboard</h1>
        <p className="text-sm text-civic-muted dark:text-slate-400 mt-1">
          Live procurement analytics and asset age profiling powered by Streamlit.
        </p>
      </div>

      <div className="flex-1 rounded-2xl overflow-hidden border border-civic-border dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900">
        <iframe
          src={STREAMLIT_EMBED_URL}
          title="BCC Asset Intelligence Dashboard"
          width="100%"
          height="100%"
          className="min-h-[700px] border-none"
          allow="fullscreen"
        />
      </div>

      <p className="text-xs text-civic-muted dark:text-slate-500 text-center mt-2">
        Having trouble viewing?{' '}
        <a
          href={STREAMLIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-civic-primary underline hover:text-blue-700"
        >
          Open in a new tab →
        </a>
      </p>
    </div>
  );
};

export default Analytics;
