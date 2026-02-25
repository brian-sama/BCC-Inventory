import React from 'react';

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  actions,
  children,
  className = '',
  contentClassName = '',
}) => {
  return (
    <section className={`surface-card ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-lg font-semibold text-civic-text">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-civic-muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      )}
      <div className={contentClassName}>{children}</div>
    </section>
  );
};

export default SectionCard;
