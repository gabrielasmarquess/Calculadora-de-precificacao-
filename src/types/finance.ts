export type Marketplace = 'Mercado Livre' | 'Shopee' | 'TikTok Shop' | 'Outro';

export type OrderLogisticStatus = 
  | 'venda_registrada'
  | 'aguardando_compra'
  | 'produto_comprado'
  | 'pedido_enviado'
  | 'pedido_concluido'
  | 'pedido_cancelado';

export type TransferStatus = 'pendente' | 'recebido_integral' | 'recebido_divergente' | 'recebido_parcial';

export interface Product {
  id: string;
  userId: string;
  name: string;
  internalCode?: string; // Código interno ou SKU
  category?: string;
  brand?: string;
  modelOrVariation?: string; // Modelo, tamanho, volume ou variação
  description?: string;
  habitualCost: number; // Custo de compra habitual de referência
  referencePrice: number; // Preço de venda de referência sugerido
  preferredMarketplace?: Marketplace | 'Todos';
  notes?: string;
  isArchived?: boolean;
  syncStatus?: 'sincronizado' | 'pendente_sincronizacao';
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productName: string;
  sku?: string;
  productId?: string; // Vínculo de referência do catálogo (se selecionado do catálogo)
  quantity: number;
  unitCost: number; // Custo de compra unitário
  unitPrice: number; // Preço de venda unitário
  totalCost: number; // quantity * unitCost
  totalPrice: number; // quantity * unitPrice
  isPurchased?: boolean; // Se o produto já foi comprado do fornecedor
  purchaseId?: string; // Vínculo com a compra específica
}

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  marketplace: Marketplace;
  saleDate: string; // YYYY-MM-DD
  items: OrderItem[];
  grossAmount: number; // Valor bruto total da venda
  estimatedTransferAmount: number; // Valor estimado do repasse líquido do marketplace
  knownFeesAmount: number; // Taxas e outros custos conhecidos da plataforma
  expectedTransferDate: string; // Data prevista para receber o repasse
  notes?: string;
  
  // Situação logística (separada da financeira)
  logisticStatus: OrderLogisticStatus;
  
  // Situação financeira do repasse
  transferStatus: TransferStatus;
  actualTransferAmount: number; // Valor total efetivamente recebido
  actualTransferDate?: string; // Data do recebimento mais recente
  transferDivergence: number; // actualTransferAmount - estimatedTransferAmount
  
  createdAt: string;
  updatedAt: string;
}

export interface TransferPaymentEntry {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  receivedDate: string;
  paymentType: 'integral' | 'parcial' | 'divergente';
  notes?: string;
  createdAt: string;
}

export type PaymentMethod = 'Pix' | 'Cartão de Crédito' | 'Boleto' | 'Dinheiro' | 'Débito' | 'Transferência Bancária' | 'Outro';

export type PaymentStatus = 'nao_pago' | 'parcialmente_pago' | 'pago' | 'parcelado';

export interface Installment {
  id: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string; // Data de vencimento YYYY-MM-DD
  status: 'pendente' | 'pago';
  paidDate?: string;
  paymentMethod: PaymentMethod;
}

export interface Purchase {
  id: string;
  userId: string;
  productDescription: string;
  supplierName: string;
  relatedOrderIds: string[]; // Pedidos atendidos por esta compra
  quantity: number;
  totalCost: number;
  purchaseDate: string;
  dueDate: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  installments: Installment[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory = 
  | 'Embalagens e Caixas'
  | 'Etiquetas e Fita Adesiva'
  | 'Papel e Impressão'
  | 'Materiais de Envio'
  | 'Transporte e Uber'
  | 'Combustível'
  | 'Publicidade e Anúncios'
  | 'Tarifas e Serviços'
  | 'Software e Assinaturas'
  | 'Compras Diversas Operacionais'
  | 'Outras Despesas';

export interface Expense {
  id: string;
  userId: string;
  description: string;
  category: ExpenseCategory | string;
  amount: number;
  expenseDate: string;
  dueDate?: string;
  relatedMarketplace: Marketplace | 'Operação Geral';
  relatedOrderId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  installments: Installment[];
  notes?: string;
  receiptUrl?: string; // Comprovante opcional (nome do arquivo ou link)
  isExternalCreditCardItem?: boolean; // Se for item pessoal/externo da fatura para desconsiderar
  createdAt: string;
  updatedAt: string;
}

export interface CashInitialBalance {
  userId: string;
  amount: number;
  startDate: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  loginTime: string;
  userAgent: string;
  deviceType: string;
  browser: string;
  isCurrentSession: boolean;
}

export interface AccessLog {
  id: string;
  userId: string;
  timestamp: string;
  action: 'login' | 'logout' | 'password_change' | 'import_data' | 'export_data';
  details: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  companyName?: string;
  createdAt: string;
}

export interface TrajectoryMemory {
  id: string;
  userId: string;
  imageUrl: string; // Base64 dataURL ou caminho persistido
  caption: string; // Legenda (ex: "Despachando os pedidos de segunda-feira")
  date: string; // Data YYYY-MM-DD
  packagesCount: number; // Quantidade de pacotes associada à foto
  milestonePhase?: string; // Ex: "Meu primeiro pacote", "Mais de 10 encomendas por dia"
  createdAt: string;
}
