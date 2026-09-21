import React from 'react';
import { InfoTooltip } from './InfoTooltip';

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
  step = 1,
  min = 0,
  max,
  tooltipText,
  tooltipTitle,
  tooltipExample,
  placeholder,
  helperText,
  highlight = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(',', '.');
    if (rawVal === '') {
      onChange(0);
      return;
    }
    const num = parseFloat(rawVal);
    if (!isNaN(num)) {
      onChange(num);
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
          type="number"
          step={step}
          min={min}
          max={max}
          value={value === 0 && placeholder ? '' : value}
          onChange={handleChange}
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
