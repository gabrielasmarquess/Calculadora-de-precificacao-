import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface InfoTooltipProps {
  id?: string;
  title?: string;
  text: string;
  example?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  id,
  title,
  text,
  example,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Mais informações"
        className="p-1 rounded-full text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 bottom-full mb-2 w-72 max-w-[85vw] p-3.5 bg-slate-900 text-white rounded-xl shadow-xl text-xs leading-relaxed animate-in fade-in zoom-in-95 duration-150 border border-slate-700">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            {title ? (
              <span className="font-semibold text-emerald-400 text-xs">
                {title}
              </span>
            ) : (
              <span className="font-semibold text-slate-300 text-xs">
                Explicação
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded focus:outline-none"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-200">{text}</p>
          {example && (
            <div className="mt-2 p-2 bg-slate-800/80 rounded border border-slate-700/60 text-[11px] text-emerald-300 font-medium">
              💡 {example}
            </div>
          )}
          <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700"></div>
        </div>
      )}
    </div>
  );
};
