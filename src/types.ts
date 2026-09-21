export type TargetType = 'profit' | 'margin';

export interface PricingState {
  // Custos
  productCost: number;
  otherCosts: number;
  
  // Taxas
  commissionPct: number;
  fixedFee: number;
  otherFeesPct: number;
  otherFixedFees: number;
  taxPct: number;
  
  // Meta
  targetType: TargetType;
  desiredProfit: number;
  desiredMarginPct: number;
  minAcceptableMarginPct: number;
}

export type SaleStatus = 'success' | 'warning' | 'neutral' | 'danger';

export interface SaleCalculation {
  sellingPrice: number;
  percentFeesValue: number;
  fixedFeesValue: number;
  totalFees: number;
  totalCost: number;
  netProfit: number;
  netMarginPct: number;
  targetMarginPct: number;
  marginDiffPct: number;
  status: SaleStatus;
  statusTitle: string;
  statusDescription: string;
  statusDetail?: string;
  isValid: boolean;
  errorMessage?: string;
}

export interface SimulationRow {
  id: string;
  price: number;
  fees: number;
  cost: number;
  profit: number;
  marginPct: number;
  status: SaleStatus;
  statusLabel: string;
  isCustom?: boolean;
}
