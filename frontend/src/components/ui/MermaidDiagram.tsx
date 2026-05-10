import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Renders a Mermaid diagram from a source string.
 *
 * - mermaid is lazy-imported on first mount so it doesn't bloat the entry bundle
 * - the theme palette mirrors the app's CSS custom properties so diagrams look
 *   native in dark mode
 * - re-renders when `chart` changes
 */
export interface MermaidDiagramProps {
  /** Mermaid source code. */
  chart: string;
  /** Optional CSS class for the wrapping element. */
  className?: string;
  /** Optional inline styles for the wrapper. */
  style?: React.CSSProperties;
  /** Optional fixed minimum width to prevent label overlap on narrow viewports. */
  minWidth?: number;
}

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        fontFamily: 'inherit',
        themeVariables: {
          // Palette taken from the app's CSS variables so diagrams blend into
          // the surrounding cards.
          background:        'transparent',
          primaryColor:      '#1c1c24',
          primaryTextColor:  '#e6e6f0',
          primaryBorderColor:'#7c6ef5',
          secondaryColor:    '#26262f',
          tertiaryColor:     '#1c1c24',
          lineColor:         '#7c6ef5',
          textColor:         '#e6e6f0',
          mainBkg:           '#1c1c24',
          nodeTextColor:     '#e6e6f0',
          edgeLabelBackground:'#0e0e14',
          clusterBkg:        'rgba(124, 110, 245, 0.06)',
          clusterBorder:     '#3a3a48',
          fontSize:          '13px',
        },
        flowchart: {
          curve: 'basis',
          padding: 16,
          nodeSpacing: 36,
          rankSpacing: 48,
          htmlLabels: true,
        },
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

export default function MermaidDiagram({
  chart,
  className,
  style,
  minWidth,
}: MermaidDiagramProps) {
  // useId gives us a stable, SSR-safe id; replace colons because mermaid uses
  // them as cluster separators and would choke.
  const reactId = useId().replace(/:/g, '');
  const elementId = useMemo(() => `mermaid-${reactId}`, [reactId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    loadMermaid()
      .then(async (mermaid) => {
        if (cancelled || !containerRef.current) return;
        try {
          // mermaid.render returns a fresh SVG string every call — much safer
          // than mutating the DOM ourselves.
          const { svg } = await mermaid.render(elementId, chart);
          if (cancelled || !containerRef.current) return;
          containerRef.current.innerHTML = svg;
        } catch (e) {
          if (cancelled) return;
          // Don't crash the page on a bad diagram — surface it inline.
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [chart, elementId]);

  if (error) {
    return (
      <pre style={{
        padding: '0.75rem 1rem',
        fontSize: '0.78rem',
        color: '#f5617c',
        background: 'rgba(245, 97, 124, 0.08)',
        border: '1px solid rgba(245, 97, 124, 0.25)',
        borderRadius: 'var(--radius-sm)',
        overflowX: 'auto',
      }}>
        Mermaid render error: {error}
      </pre>
    );
  }

  return (
    <div
      className={className}
      style={{
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center',
        ...style,
      }}
    >
      <div
        ref={containerRef}
        style={{
          minWidth: minWidth ? `${minWidth}px` : undefined,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}
      />
    </div>
  );
}
