import { PricingState, SaleCalculation, SaleStatus, SimulationRow } from '../types';

export const DEFAULT_PRICING_STATE: PricingState = {
  productCost: 20.0,
  otherCosts: 0.0,
  commissionPct: 17.0,
  fixedFee: 6.0,
  otherFeesPct: 0.0,
  otherFixedFees: 0.0,
  taxPct: 0.0,
  targetType: 'profit',
  desiredProfit: 10.0,
  desiredMarginPct: 20.0,
  minAcceptableMarginPct: 20.0,
};

export const DEFAULT_SIMULATION_PRICES = [
  15, 20, 25, 30, 35, 40, 50, 60, 80, 100, 150, 200, 250, 300,
];

export {
  formatCurrency,
  formatCurrencyRaw,
  formatPercent,
  formatPoints,
  parseCurrency,
  roundCents,
  toCents,
  fromCents,
  safeAdd,
  safeSubtract,
  safeMultiply,
} from './currency';
import {
  formatCurrency,
  formatPercent,
  formatPoints,
  roundCents,
} from './currency';

/**
 * Avalia a situação e gera mensagens descritivas para a venda
 */
export function evaluateSaleStatus(
  netProfit: number,
  netMarginPct: number,
  minAcceptableMarginPct: number
): {
  status: SaleStatus;
  statusTitle: string;
  statusDescription: string;
  statusDetail?: string;
  statusLabel: string;
} {
  // Lucro negativo
  if (netProfit < -0.005) {
    return {
      status: 'danger',
      statusTitle: '🔴 Essa venda gera prejuízo',
      statusDescription: `Você está perdendo ${formatCurrency(Math.abs(netProfit))} nessa venda.`,
      statusDetail: 'O preço de venda não cobre os custos e as taxas da plataforma.',
      statusLabel: 'Prejuízo',
    };
  }

  // Lucro exatamente zero
  if (Math.abs(netProfit) <= 0.005) {
    return {
      status: 'neutral',
      statusTitle: '⚠️ Você não está tendo lucro',
      statusDescription: 'Depois de pagar os custos e as taxas, você fica no zero a zero.',
      statusDetail: 'Você não perde dinheiro, mas também não tem margem de ganho.',
      statusLabel: 'Sem lucro',
    };
  }

  // Margem abaixo da margem mínima
  if (netMarginPct < minAcceptableMarginPct - 0.005) {
    const diff = minAcceptableMarginPct - netMarginPct;
    return {
      status: 'warning',
      statusTitle: '⚠️ Abaixo da sua margem mínima',
      statusDescription: `Você está ganhando ${formatCurrency(netProfit)}, mas sua margem de ${formatPercent(netMarginPct)} está abaixo da sua meta de ${formatPercent(minAcceptableMarginPct)}.`,
      statusDetail: `Faltam ${formatPoints(diff)} pontos percentuais para atingir sua meta.`,
      statusLabel: 'Abaixo da meta',
    };
  }

  // Margem igual ou maior que a margem mínima
  const diffAbove = netMarginPct - minAcceptableMarginPct;
  return {
    status: 'success',
    statusTitle: '✓ Dentro da sua meta',
    statusDescription: `Você está ganhando ${formatCurrency(netProfit)} nessa venda, com margem de ${formatPercent(netMarginPct)}.`,
    statusDetail: diffAbove >= 0.01 
      ? `Você está ${formatPoints(diffAbove)} pontos percentuais acima da sua margem mínima.`
      : 'Sua margem atingiu perfeitamente sua margem mínima aceitável.',
    statusLabel: 'Dentro da meta',
  };
}

/**
 * Calcula o resultado financeiro para um preço de venda específico
 */
export function calculateSaleForPrice(
  price: number,
  state: PricingState
): SaleCalculation {
  const totalPercentFeesPct = state.commissionPct + state.otherFeesPct + state.taxPct;
  
  if (totalPercentFeesPct >= 100) {
    return {
      sellingPrice: price,
      percentFeesValue: 0,
      fixedFeesValue: 0,
      totalFees: 0,
      totalCost: state.productCost + state.otherCosts,
      netProfit: 0,
      netMarginPct: 0,
      targetMarginPct: state.minAcceptableMarginPct,
      marginDiffPct: 0,
      status: 'danger',
      statusTitle: 'Não é possível calcular',
      statusDescription: 'Não é possível calcular. As taxas percentuais precisam ser menores que 100%.',
      isValid: false,
      errorMessage: 'As taxas percentuais precisam ser menores que 100%.',
    };
  }

  if (price <= 0) {
    return {
      sellingPrice: 0,
      percentFeesValue: 0,
      fixedFeesValue: 0,
      totalFees: 0,
      totalCost: state.productCost + state.otherCosts,
      netProfit: -(state.productCost + state.otherCosts + state.fixedFee + state.otherFixedFees),
      netMarginPct: 0,
      targetMarginPct: state.minAcceptableMarginPct,
      marginDiffPct: -state.minAcceptableMarginPct,
      status: 'danger',
      statusTitle: '🔴 Preço inválido',
      statusDescription: 'Informe um preço de venda maior que zero.',
      isValid: false,
    };
  }

  const percentFeesValue = roundCents(price * (totalPercentFeesPct / 100));
  const fixedFeesValue = roundCents(state.fixedFee + state.otherFixedFees);
  const totalFees = roundCents(percentFeesValue + fixedFeesValue);
  const totalCost = roundCents(state.productCost + state.otherCosts);
  const netProfit = roundCents(price - totalFees - totalCost);
  const netMarginPct = price > 0 ? roundCents(((netProfit / price) * 100)) : 0;
  const marginDiffPct = roundCents(netMarginPct - state.minAcceptableMarginPct);

  const evaluation = evaluateSaleStatus(netProfit, netMarginPct, state.minAcceptableMarginPct);

  return {
    sellingPrice: price,
    percentFeesValue,
    fixedFeesValue,
    totalFees,
    totalCost,
    netProfit,
    netMarginPct,
    targetMarginPct: state.minAcceptableMarginPct,
    marginDiffPct,
    status: evaluation.status,
    statusTitle: evaluation.statusTitle,
    statusDescription: evaluation.statusDescription,
    statusDetail: evaluation.statusDetail,
    isValid: true,
  };
}

/**
 * Calcula o Preço Ideal com base na meta selecionada (lucro em R$ ou margem em %)
 */
export function calculateIdealPrice(state: PricingState): {
  idealPrice: number;
  isValid: boolean;
  errorMessage?: string;
} {
  const totalPercentFeesPct = state.commissionPct + state.otherFeesPct + state.taxPct;
  const totalFixedCosts =
    state.productCost + state.otherCosts + state.fixedFee + state.otherFixedFees;

  if (totalPercentFeesPct >= 100) {
    return {
      idealPrice: 0,
      isValid: false,
      errorMessage: 'Não é possível calcular. As taxas percentuais precisam ser menores que 100%.',
    };
  }

  if (state.targetType === 'profit') {
    // Fórmula lucro fixo:
    // (Custo + Outros custos + Taxas fixas + Outras taxas fixas + Lucro desejado) / (1 - TotalPercentFees)
    const numerator = totalFixedCosts + Math.max(0, state.desiredProfit);
    const denominator = 1 - totalPercentFeesPct / 100;

    if (denominator <= 0) {
      return {
        idealPrice: 0,
        isValid: false,
        errorMessage: 'Não é possível calcular. As taxas percentuais precisam ser menores que 100%.',
      };
    }

    const price = numerator / denominator;
    return {
      idealPrice: isFinite(price) && !isNaN(price) ? roundCents(price) : 0,
      isValid: true,
    };
  } else {
    // Fórmula margem desejada:
    // (Custo + Outros custos + Taxas fixas + Outras taxas fixas) / (1 - TotalPercentFees - Margem desejada)
    const denominator = 1 - (totalPercentFeesPct + state.desiredMarginPct) / 100;

    if (denominator <= 0) {
      return {
        idealPrice: 0,
        isValid: false,
        errorMessage:
          'Não é possível calcular com esta meta: a soma das taxas e da margem desejada deve ser menor que 100%.',
      };
    }

    const price = totalFixedCosts / denominator;
    return {
      idealPrice: isFinite(price) && !isNaN(price) ? roundCents(price) : 0,
      isValid: true,
    };
  }
}

/**
 * Calcula o Preço Necessário para atingir a Margem Mínima aceitável
 */
export function calculateMinRequiredPrice(state: PricingState): {
  minPrice: number;
  isValid: boolean;
  errorMessage?: string;
} {
  const totalPercentFeesPct = state.commissionPct + state.otherFeesPct + state.taxPct;
  const totalFixedCosts =
    state.productCost + state.otherCosts + state.fixedFee + state.otherFixedFees;

  const denominator = 1 - (totalPercentFeesPct + state.minAcceptableMarginPct) / 100;

  if (denominator <= 0) {
    return {
      minPrice: 0,
      isValid: false,
      errorMessage:
        'A soma das taxas percentuais e da margem mínima não pode ser igual ou superior a 100%.',
    };
  }

  const price = totalFixedCosts / denominator;
  return {
    minPrice: isFinite(price) && !isNaN(price) ? roundCents(price) : 0,
    isValid: true,
  };
}

/**
 * Gera as linhas para a Tabela de Simulação de Preços
 */
export function generateSimulationRows(
  prices: number[],
  state: PricingState
): SimulationRow[] {
  return prices.map((price) => {
    const sale = calculateSaleForPrice(price, state);
    const evaluation = evaluateSaleStatus(
      sale.netProfit,
      sale.netMarginPct,
      state.minAcceptableMarginPct
    );

    return {
      id: `sim-${price}`,
      price,
      fees: sale.totalFees,
      cost: sale.totalCost,
      profit: sale.netProfit,
      marginPct: sale.netMarginPct,
      status: evaluation.status,
      statusLabel: evaluation.statusLabel,
    };
  });
}
