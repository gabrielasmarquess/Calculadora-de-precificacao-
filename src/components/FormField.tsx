import React, { useState, useEffect, useRef } from 'react';
import { InfoTooltip } from './InfoTooltip';
import { parseCurrency, formatCurrencyRaw, roundCents } from '../utils/currency';

interface FormFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (val: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  tooltipText?: string;
  tooltipTitle?: string;
  tooltipExample?: string;
  placeholder?: string;
  helperText?: string;
  highlight?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  max,
  tooltipText,
  tooltipTitle,
  tooltipExample,
  placeholder,
  helperText,
  highlight = false,
}) => {
  const isFocusedRef = useRef(false);

  // Formata o valor numérico inicial para exibição amigável
  const formatInitialDisplay = (num: number): string => {
    if (isNaN(num) || !isFinite(num) || num === 0) {
      return placeholder ? '' : '0';
    }
    // Se o número tem casas decimais (ex: 15.9, 20.5), formatar com vírgula decimal
    if (num % 1 !== 0) {
      return formatCurrencyRaw(num, 1, 2);
    }
    return String(num);
  };

  const [displayValue, setDisplayValue] = useState<string>(() => formatInitialDisplay(value));

  // Sincroniza valor quando vem de fora (ex: reset ou cálculo)
  useEffect(() => {
    if (!isFocusedRef.current) {
      const currentParsed = parseCurrency(displayValue);
      if (Math.abs(currentParsed - value) > 0.0001) {
        setDisplayValue(formatInitialDisplay(value));
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Converte ponto do teclado numérico em vírgula
    raw = raw.replace(/\./g, ',');

    // Permitir apenas números, uma única vírgula e sinal negativo se min < 0
    let filtered = '';
    let commaCount = 0;

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if (char >= '0' && char <= '9') {
        filtered += char;
      } else if (char === ',') {
        if (commaCount === 0) {
          filtered += ',';
          commaCount++;
        }
      } else if (char === '-' && min < 0 && i === 0) {
        filtered += '-';
      }
    }

    // Se começou com vírgula (ex: ",50"), prefixar com 0
    if (filtered.startsWith(',')) {
      filtered = '0' + filtered;
    }

    // Limitar a no máximo 2 casas decimais após a vírgula
    if (filtered.includes(',')) {
      const parts = filtered.split(',');
      if (parts[1] && parts[1].length > 2) {
        filtered = `${parts[0]},${parts[1].slice(0, 2)}`;
      }
    }

    setDisplayValue(filtered);

    if (filtered === '' || filtered === '-') {
      onChange(0);
      return;
    }

    const parsed = parseCurrency(filtered);
    let constrained = parsed;
    if (min !== undefined && constrained < min) constrained = min;
    if (max !== undefined && constrained > max) constrained = max;

    onChange(roundCents(constrained));
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const parsed = parseCurrency(displayValue);

    let constrained = parsed;
    if (min !== undefined && constrained < min) constrained = min;
    if (max !== undefined && constrained > max) constrained = max;

    if (constrained === 0 && placeholder) {
      setDisplayValue('');
    } else if (constrained % 1 !== 0) {
      setDisplayValue(formatCurrencyRaw(constrained, 2, 2));
    } else {
      setDisplayValue(String(constrained));
    }

    onChange(roundCents(constrained));
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    if (value === 0 && displayValue === '0' && placeholder) {
      setDisplayValue('');
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className={`text-sm font-semibold flex items-center gap-1.5 ${
            highlight ? 'text-emerald-950 font-bold' : 'text-slate-800'
          }`}
        >
          <span>{label}</span>
          {tooltipText && (
            <InfoTooltip
              id={`tooltip-${id}`}
              title={tooltipTitle || label}
              text={tooltipText}
              example={tooltipExample}
            />
          )}
        </label>
        {helperText && (
          <span className="text-[11px] text-slate-500 font-medium">{helperText}</span>
        )}
      </div>

      <div
        className={`relative flex items-center rounded-xl border bg-white shadow-xs transition-all duration-150 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:border-emerald-600 ${
          highlight
            ? 'border-emerald-400/80 bg-emerald-50/30'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {prefix && (
          <span className="pl-3.5 pr-1.5 text-sm font-semibold text-slate-500 select-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder || '0'}
          className="w-full py-3 px-3 text-base sm:text-sm font-semibold text-slate-900 bg-transparent rounded-xl focus:outline-none placeholder:text-slate-400"
        />
        {suffix && (
          <span className="pr-3.5 pl-1 text-sm font-semibold text-slate-500 select-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};
