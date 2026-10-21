/**
 * Utilitários Globais de Formatação e Conversão de Moeda Brasileira (BRL)
 * Suporta inteiros e decimais com centavos (ex: R$ 10,50; R$ 1.234,56; R$ 0,99).
 * Evita erros de precisão de ponto flutuante usando aritmética com centavos inteiros.
 */

/**
 * Converte qualquer valor em reais para centavos inteiros (evita imprecisão de float)
 */
export function toCents(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100);
}

/**
 * Converte centavos inteiros de volta para reais
 */
export function fromCents(cents: number): number {
  if (isNaN(cents) || !isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

/**
 * Arredonda um número para 2 casas decimais de centavos com precisão
 */
export function roundCents(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Soma segura de dois valores monetários em reais (usando centavos)
 */
export function safeAdd(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * Subtração segura de dois valores monetários em reais (usando centavos)
 */
export function safeSubtract(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Multiplicação segura de quantidade e preço unitário
 */
export function safeMultiply(price: number, quantity: number): number {
  return roundCents(price * quantity);
}

/**
 * Formata um número no padrão BRL completo: "R$ 1.234,56" ou "-R$ 10,50"
 */
export function formatCurrency(value: number): string {
  if (isNaN(value) || !isFinite(value)) {
    return 'R$ 0,00';
  }
  const rounded = roundCents(value);
  const isNegative = rounded < -0.00001;
  const absValue = Math.abs(rounded);
  const formatted = absValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-R$ ${formatted}` : `R$ ${formatted}`;
}

/**
 * Formata um número no padrão BRL numérico sem "R$": "1.234,56" ou "0,50"
 */
export function formatCurrencyRaw(value: number, minDecimals = 2, maxDecimals = 2): string {
  if (isNaN(value) || !isFinite(value)) {
    return '0,00';
  }
  const rounded = roundCents(value);
  const absValue = Math.abs(rounded);
  return absValue.toLocaleString('pt-BR', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Formata percentual brasileiro: "17,00%" ou "+3,06%"
 */
export function formatPercent(value: number, includeSign = false, decimals = 2): string {
  if (isNaN(value) || !isFinite(value)) {
    return '0,00%';
  }
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (includeSign && value > 0.0001) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Formata pontos percentuais (ex: +3,06 ou -5,20)
 */
export function formatPoints(value: number, decimals = 2): string {
  if (isNaN(value) || !isFinite(value)) {
    return '0,00';
  }
  const formatted = Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (value > 0.0001) {
    return `+${formatted}`;
  } else if (value < -0.0001) {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * Converte string digitada pelo usuário ou importada para número float com centavos.
 * Trata vírgulas, pontos de milhar, símbolos "R$", espaços e casas decimais.
 * Exemplos:
 * "15,90" -> 15.90
 * "129,99" -> 129.99
 * "0,50" -> 0.50
 * ",50" -> 0.50
 * "1.250,75" -> 1250.75
 * "15.90" -> 15.90
 * "R$ 1.250,75" -> 1250.75
 */
export function parseCurrency(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') {
    return isNaN(input) || !isFinite(input) ? 0 : roundCents(input);
  }

  let str = String(input).trim();
  if (!str) return 0;

  // Remover R$, espaços normais e non-breaking spaces
  str = str.replace(/[R$\s\u00A0]/g, '');
  if (!str) return 0;

  const isNegative = str.startsWith('-') || str.endsWith('-');
  str = str.replace(/-/g, '');

  // Tratar caso onde usuário começa com vírgula ou ponto (ex: ",50" ou ".50")
  if (str.startsWith(',') || str.startsWith('.')) {
    str = '0' + str;
  }

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Formato brasileiro: 1.234,56 -> 1234.56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato internacional: 1,234.56 -> 1234.56
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Apenas vírgula: 15,90 ou 1250,75
    str = str.replace(',', '.');
  } else if (hasDot) {
    // Apenas ponto: verificar se são múltiplos pontos (milhar: 1.000.000) ou ponto decimal (15.90)
    const parts = str.split('.');
    if (parts.length > 2) {
      str = parts.join('');
    } else {
      // Mantém como decimal normal
    }
  }

  const num = parseFloat(str);
  if (isNaN(num) || !isFinite(num)) return 0;

  const finalVal = isNegative ? -num : num;
  return roundCents(finalVal);
}
