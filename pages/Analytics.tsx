import React, { useState } from 'react';
import { STREAMLIT_EMBED_URL, STREAMLIT_URL } from '../services/streamlitConfig';
import PageHeader from '../components/ui/PageHeader';

const Analytics: React.FC = () => {
  const [isFrameLoading, setIsFrameLoading] = useState(true);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <PageHeader
        title="Asset Intelligence Dashboard"
        subtitle="Live procurement analytics and asset age profiling powered by Streamlit."
      />

      <div className="flex-1 relative rounded-2xl overflow-hidden border border-civic-border dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900">
        {isFrameLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 z-10">
            <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-civic-primary animate-spin" />
            <p className="text-sm text-civic-muted">Loading analytics dashboard...</p>
          </div>
        )}
        <iframe
          src={STREAMLIT_EMBED_URL}
          title="BCC Asset Intelligence Dashboard"
          width="100%"
          height="100%"
          className="min-h-[700px] border-none"
          onLoad={() => setIsFrameLoading(false)}
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
          Open in a new tab
        </a>
      </p>
    </div>
  );
};

export default Analytics;
