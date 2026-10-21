import React, { useState, useEffect, useRef } from 'react';
import { parseCurrency, formatCurrencyRaw, roundCents } from '../../utils/currency';

export interface CurrencyInputProps {
  id?: string;
  name?: string;
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  allowDecimals?: boolean;
  decimals?: number;
}

/**
 * Campo de Entrada Monetário e Decimal Padrão Brasileiro (BRL)
 * - Permite digitar centavos normalmente (ex: 15,90; 129,99; 0,50; 1.250,75).
 * - Aceita tanto vírgula (,) quanto ponto (.) do teclado numérico, convertendo para vírgula.
 * - Não apaga nem reseta a vírgula enquanto o usuário está digitando centavos.
 * - Evita imprecisão de ponto flutuante arredondando para centavos reais.
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = '0,00',
  className = '',
  prefix,
  suffix,
  min = 0,
  max,
  disabled = false,
  required = false,
  autoFocus = false,
  onBlur,
  onFocus,
  allowDecimals = true,
  decimals = 2,
}) => {
  const isFocusedRef = useRef(false);

  // Formata o número inicial para exibição amigável
  const formatInitialDisplay = (num: number): string => {
    if (isNaN(num) || !isFinite(num) || num === 0) {
      return placeholder ? '' : '0,00';
    }
    return formatCurrencyRaw(num, allowDecimals ? 2 : 0, decimals);
  };

  const [displayValue, setDisplayValue] = useState<string>(() => formatInitialDisplay(value));

  // Sincroniza valor quando vem de fora (ex: reset, cálculo automático, carregamento)
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

    // Se o usuário digitou ponto no teclado numérico, converter para vírgula
    raw = raw.replace(/\./g, ',');

    // Permitir apenas dígitos, uma única vírgula e hífen se min < 0
    let filtered = '';
    let commaCount = 0;

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if (char >= '0' && char <= '9') {
        filtered += char;
      } else if (char === ',' && allowDecimals) {
        if (commaCount === 0) {
          filtered += ',';
          commaCount++;
        }
      } else if (char === '-' && min < 0 && i === 0) {
        filtered += '-';
      }
    }

    // Se começou com vírgula (ex: ",50"), colocar "0,"
    if (filtered.startsWith(',')) {
      filtered = '0' + filtered;
    }

    // Limitar casas decimais se já houver vírgula
    if (filtered.includes(',')) {
      const parts = filtered.split(',');
      if (parts[1] && parts[1].length > decimals) {
        filtered = `${parts[0]},${parts[1].slice(0, decimals)}`;
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
    } else {
      setDisplayValue(formatCurrencyRaw(constrained, allowDecimals ? 2 : 0, decimals));
    }

    onChange(roundCents(constrained));
    if (onBlur) onBlur();
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    if (value === 0 && displayValue === '0,00' && placeholder) {
      setDisplayValue('');
    }
    if (onFocus) onFocus();
  };

  return (
    <div className={`relative flex items-center w-full ${prefix || suffix ? '' : ''}`}>
      {prefix && (
        <span className="pl-3 pr-1 text-sm font-semibold text-slate-500 select-none shrink-0">
          {prefix}
        </span>
      )}
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={className}
      />
      {suffix && (
        <span className="pr-3 pl-1 text-sm font-semibold text-slate-500 select-none shrink-0">
          {suffix}
        </span>
      )}
    </div>
  );
};
