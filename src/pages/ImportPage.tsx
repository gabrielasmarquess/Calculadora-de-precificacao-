import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  ArrowRight,
  RefreshCw,
  FileText,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { ordersRepo, logsRepo } from '../services/db';
import { Order, OrderItem, Marketplace } from '../types/finance';
import { formatCurrency } from '../utils/pricing';

interface ImportPageProps {
  userId: string;
}

interface ParsedRow {
  index: number;
  raw: Record<string, string>;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  mappedData?: {
    orderNumber: string;
    marketplace: Marketplace;
    saleDate: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    grossAmount: number;
    estimatedTransferAmount: number;
    knownFeesAmount: number;
  };
}

export const ImportPage: React.FC<ImportPageProps> = ({ userId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [columns, setColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);

  // Column mapping states
  const [mapping, setMapping] = useState<{
    orderNumber: string;
    marketplace: string;
    saleDate: string;
    productName: string;
    quantity: string;
    unitPrice: string;
    grossAmount: string;
    estimatedTransfer: string;
    knownFees: string;
  }>({
    orderNumber: '',
    marketplace: '',
    saleDate: '',
    productName: '',
    quantity: '',
    unitPrice: '',
    grossAmount: '',
    estimatedTransfer: '',
    knownFees: '',
  });

  // Validation results
  const [analyzedRows, setAnalyzedRows] = useState<ParsedRow[]>([]);
  const [importResults, setImportResults] = useState<{
    importedCount: number;
    rejectedCount: number;
    rejectedDetails: { row: number; reason: string }[];
  } | null>(null);

  // Parse CSV text with quote support and auto-detecting comma or semicolon
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      alert('O arquivo deve conter ao menos um cabeçalho e uma linha de dados.');
      return;
    }

    // Detect delimiter (; or ,)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const header = parseLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
    setColumns(header);

    const parsed: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;
      const row: Record<string, string> = {};
      header.forEach((col, idx) => {
        row[col] = values[idx] ? values[idx].replace(/^["']|["']$/g, '').trim() : '';
      });
      parsed.push(row);
    }

    setRawRows(parsed);

    // Auto-detect columns intelligently
    const autoMap = {
      orderNumber: header.find((h) => /pedido|numero|ordem|order|id/i.test(h)) || header[0] || '',
      marketplace: header.find((h) => /canal|marketplace|plataforma|loja/i.test(h)) || '',
      saleDate: header.find((h) => /data|date|venda|dia/i.test(h)) || '',
      productName: header.find((h) => /produto|item|descricao|titulo|name/i.test(h)) || '',
      quantity: header.find((h) => /qtd|quantidade|quant|unid/i.test(h)) || '',
      unitPrice: header.find((h) => /unitario|preco_unit|valor_unit/i.test(h)) || '',
      grossAmount: header.find((h) => /valor|total|bruto|preco|venda/i.test(h)) || '',
      estimatedTransfer: header.find((h) => /repasse|liquido|receber/i.test(h)) || '',
      knownFees: header.find((h) => /taxa|comissao|tarifas/i.test(h)) || '',
    };
    setMapping(autoMap);
    setStep(2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    setFile(uploaded);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        parseCSV(content);
      }
    };
    reader.readAsText(uploaded, 'utf-8');
  };

  // Step 2 to Step 3: Analyze and Validate
  const handleProceedToPreview = () => {
    if (!mapping.orderNumber) {
      alert('Por favor, selecione a coluna correspondente ao Número do Pedido.');
      return;
    }

    const existingOrders = ordersRepo.list(userId);
    const existingOrderNumbers = new Set(
      existingOrders.map((o) => o.orderNumber.trim().toLowerCase())
    );

    const seenInFile = new Set<string>();

    const analyzed: ParsedRow[] = rawRows.map((row, idx) => {
      const errors: string[] = [];
      const orderNum = (row[mapping.orderNumber] || '').trim();

      if (!orderNum) {
        errors.push('Número do pedido ausente');
      }

      const isDuplicateInDb = orderNum ? existingOrderNumbers.has(orderNum.toLowerCase()) : false;
      const isDuplicateInFile = orderNum ? seenInFile.has(orderNum.toLowerCase()) : false;
      if (orderNum) seenInFile.add(orderNum.toLowerCase());

      if (isDuplicateInDb) {
        errors.push('Pedido já cadastrado no sistema (duplicidade)');
      } else if (isDuplicateInFile) {
        errors.push('Pedido repetido no próprio arquivo');
      }

      // Marketplace detection
      const rawMkt = (row[mapping.marketplace] || '').toLowerCase();
      let detectedMarketplace: Marketplace = 'Mercado Livre';
      if (rawMkt.includes('shopee')) detectedMarketplace = 'Shopee';
      else if (rawMkt.includes('tiktok')) detectedMarketplace = 'TikTok Shop';
      else if (rawMkt.includes('outro') || rawMkt.includes('site')) detectedMarketplace = 'Outro';

      // Parse amounts (handling Brazilian currency R$ 1.234,56 or 1234.56)
      const parseMoney = (valStr: string): number => {
        if (!valStr) return 0;
        const clean = valStr.replace(/[R$\s]/g, '');
        if (clean.includes(',') && clean.includes('.')) {
          return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
        } else if (clean.includes(',')) {
          return parseFloat(clean.replace(',', '.')) || 0;
        }
        return parseFloat(clean) || 0;
      };

      const rawGross = parseMoney(row[mapping.grossAmount]);
      const rawPrice = parseMoney(row[mapping.unitPrice]);
      const rawQty = parseInt(row[mapping.quantity]) || 1;
      const finalGross = rawGross > 0 ? rawGross : rawPrice * rawQty;

      const rawFees = parseMoney(row[mapping.knownFees]);
      let rawTransfer = parseMoney(row[mapping.estimatedTransfer]);
      if (rawTransfer <= 0 && finalGross > 0) {
        rawTransfer = Math.round(finalGross * 0.82 * 100) / 100; // estimated 18% fees default
      }

      // Date parsing
      let parsedDate = row[mapping.saleDate] || new Date().toISOString().split('T')[0];
      if (parsedDate.includes('/')) {
        const parts = parsedDate.split('/');
        if (parts.length === 3) {
          // DD/MM/YYYY to YYYY-MM-DD
          parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const isValid = errors.length === 0;

      return {
        index: idx + 1,
        raw: row,
        isValid,
        errors,
        isDuplicate: isDuplicateInDb || isDuplicateInFile,
        mappedData: {
          orderNumber: orderNum,
          marketplace: detectedMarketplace,
          saleDate: parsedDate,
          productName: (row[mapping.productName] || 'Item importado').trim(),
          quantity: rawQty,
          unitPrice: rawPrice > 0 ? rawPrice : finalGross / rawQty,
          grossAmount: finalGross,
          estimatedTransferAmount: rawTransfer,
          knownFeesAmount: rawFees,
        },
      };
    });

    setAnalyzedRows(analyzed);
    setStep(3);
  };

  // Confirm Import
  const handleConfirmImport = () => {
    const validRows = analyzedRows.filter((r) => r.isValid && r.mappedData);
    const rejectedRows = analyzedRows.filter((r) => !r.isValid);

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    validRows.forEach((row) => {
      const data = row.mappedData!;
      const item: OrderItem = {
        id: 'item_imp_' + Date.now() + '_' + row.index,
        productName: data.productName,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        unitCost: 0, // Custo pendente de preenchimento posterior
        totalPrice: data.grossAmount,
        totalCost: 0,
        isPurchased: false,
      };

      const newOrder: Order = {
        id: 'ord_imp_' + Date.now() + '_' + row.index,
        userId,
        orderNumber: data.orderNumber,
        marketplace: data.marketplace,
        saleDate: data.saleDate || today,
        items: [item],
        grossAmount: data.grossAmount,
        estimatedTransferAmount: data.estimatedTransferAmount,
        knownFeesAmount: data.knownFeesAmount,
        expectedTransferDate: nextWeek,
        logisticStatus: 'aguardando_compra',
        transferStatus: 'pendente',
        actualTransferAmount: 0,
        transferDivergence: 0,
        notes: `Importado via planilha (${file?.name || 'arquivo.csv'})`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      ordersRepo.save(newOrder);
    });

    logsRepo.addLog(
      userId,
      'import_data',
      `Importação de planilha: ${validRows.length} pedidos importados com sucesso, ${rejectedRows.length} rejeitados.`
    );

    setImportResults({
      importedCount: validRows.length,
      rejectedCount: rejectedRows.length,
      rejectedDetails: rejectedRows.map((r) => ({
        row: r.index,
        reason: r.errors.join(', '),
      })),
    });

    setStep(4);
  };

  // Download Sample CSV template for easy user testing
  const handleDownloadSampleCSV = () => {
    const csvContent =
      'Numero_Pedido;Marketplace;Data;Produto;Quantidade;Valor_Bruto;Repasse_Estimado;Taxas\n' +
      'MLB-2026-101;Mercado Livre;2026-10-15;Kit Ferramentas Precisao;1;149,90;121,50;28,40\n' +
      'SHP-2026-102;Shopee;2026-10-16;Organizador Multiuso Acrilico;2;89,90;71,92;17,98\n' +
      'TTK-2026-103;TikTok Shop;2026-10-17;Luminaria LED Magnetica;1;59,90;50,91;8,99\n';

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_importacao_lucraibr.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download current orders as CSV report
  const handleExportOrdersCSV = () => {
    const all = ordersRepo.list(userId);
    let csv = 'Numero_Pedido;Marketplace;Data;Produtos;Valor_Bruto;Repasse_Estimado;Repasse_Recebido;Divergencia;Status_Logistico;Status_Repasse\n';
    all.forEach((o) => {
      const itemsStr = o.items.map((i) => `${i.quantity}x ${i.productName}`).join(' | ');
      csv += `"${o.orderNumber}";"${o.marketplace}";"${o.saleDate}";"${itemsStr}";${o.grossAmount};${o.estimatedTransferAmount};${o.actualTransferAmount};${o.transferDivergence};"${o.logisticStatus}";"${o.transferStatus}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_vendas_lucraibr_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#064E3B] tracking-tight">
            Importação & Exportação de Planilhas
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Importe relatórios de vendas do Mercado Livre, Shopee ou TikTok Shop com mapeamento visual e prevenção de duplicidades.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSampleCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Baixar Modelo CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportOrdersCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Vendas Atuais</span>
          </button>
        </div>
      </div>

      {/* Wizard Steps Navigation */}
      <div className="grid grid-cols-4 gap-2 bg-white p-3 rounded-2xl border border-slate-200 text-xs">
        <div
          className={`p-2 rounded-xl text-center font-semibold ${
            step === 1 ? 'bg-emerald-50 text-[#064E3B] border border-emerald-300' : 'text-slate-400'
          }`}
        >
          1. Selecionar Arquivo
        </div>
        <div
          className={`p-2 rounded-xl text-center font-semibold ${
            step === 2 ? 'bg-emerald-50 text-[#064E3B] border border-emerald-300' : 'text-slate-400'
          }`}
        >
          2. Mapear Colunas
        </div>
        <div
          className={`p-2 rounded-xl text-center font-semibold ${
            step === 3 ? 'bg-emerald-50 text-[#064E3B] border border-emerald-300' : 'text-slate-400'
          }`}
        >
          3. Prévia & Validação
        </div>
        <div
          className={`p-2 rounded-xl text-center font-semibold ${
            step === 4 ? 'bg-emerald-50 text-[#064E3B] border border-emerald-300' : 'text-slate-400'
          }`}
        >
          4. Conclusão
        </div>
      </div>

      {/* STEP 1: Upload File */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#064E3B] flex items-center justify-center mx-auto">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Selecione o arquivo de vendas (.CSV ou .TXT)
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Você pode importar o relatório gerado diretamente pelo Mercado Livre, Shopee ou o nosso modelo de exemplo.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs cursor-pointer shadow-sm transition-all">
            <Upload className="w-4 h-4" />
            <span>Escolher arquivo no computador</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* STEP 2: Map Columns */}
      {step === 2 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Mapeamento das Colunas da Planilha
              </h3>
              <p className="text-xs text-slate-500">
                Identificamos {columns.length} colunas e {rawRows.length} linhas de dados no arquivo "{file?.name}".
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-slate-500 hover:underline"
            >
              Trocar arquivo
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Número do Pedido <span className="text-rose-500">*</span>
              </label>
              <select
                value={mapping.orderNumber}
                onChange={(e) => setMapping({ ...mapping, orderNumber: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              >
                <option value="">Selecione a coluna...</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Marketplace / Canal
              </label>
              <select
                value={mapping.marketplace}
                onChange={(e) => setMapping({ ...mapping, marketplace: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="">Detectar automaticamente ou padrão</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Data da Venda
              </label>
              <select
                value={mapping.saleDate}
                onChange={(e) => setMapping({ ...mapping, saleDate: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="">Data de hoje (padrão)</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nome do Produto
              </label>
              <select
                value={mapping.productName}
                onChange={(e) => setMapping({ ...mapping, productName: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="">Produto padrão</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Valor Bruto da Venda
              </label>
              <select
                value={mapping.grossAmount}
                onChange={(e) => setMapping({ ...mapping, grossAmount: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="">Selecione...</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Repasse Líquido Estimado
              </label>
              <select
                value={mapping.estimatedTransfer}
                onChange={(e) => setMapping({ ...mapping, estimatedTransfer: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="">Calcular automaticamente (~82%)</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleProceedToPreview}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs"
            >
              Avançar para Prévia & Validação
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Preview & Validation Table */}
      {step === 3 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Prévia de Importação & Detecção de Duplicidades
              </h3>
              <p className="text-xs text-slate-500">
                {analyzedRows.filter((r) => r.isValid).length} registros válidos prontos para importação.
                {analyzedRows.some((r) => !r.isValid) && (
                  <span className="text-rose-600 font-semibold ml-1">
                    ({analyzedRows.filter((r) => !r.isValid).length} com pendências/duplicados que serão rejeitados)
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Ajustar Colunas
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={analyzedRows.filter((r) => r.isValid).length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl disabled:opacity-50"
              >
                Confirmar Importação de {analyzedRows.filter((r) => r.isValid).length} Pedidos
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Linha</th>
                  <th className="py-2.5 px-3">Pedido</th>
                  <th className="py-2.5 px-3">Marketplace</th>
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3 text-right">Valor Bruto</th>
                  <th className="py-2.5 px-3 text-right">Repasse Est.</th>
                  <th className="py-2.5 px-3 text-center">Status Validação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {analyzedRows.map((r) => (
                  <tr
                    key={r.index}
                    className={!r.isValid ? 'bg-rose-50/60' : 'hover:bg-slate-50/70'}
                  >
                    <td className="py-2.5 px-3 text-slate-500 font-sans">{r.index}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {r.mappedData?.orderNumber || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-sans">{r.mappedData?.marketplace}</td>
                    <td className="py-2.5 px-3 font-sans truncate max-w-[200px]">
                      {r.mappedData?.productName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                      {formatCurrency(r.mappedData?.grossAmount || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-800">
                      {formatCurrency(r.mappedData?.estimatedTransferAmount || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      {r.isValid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          <CheckCircle className="w-3 h-3" /> Válido
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded"
                          title={r.errors.join(', ')}
                        >
                          <AlertTriangle className="w-3 h-3" /> {r.errors[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 4: Success Results & Rejections */}
      {step === 4 && importResults && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#064E3B] flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Importação Concluída com Sucesso!
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Foram adicionados <strong>{importResults.importedCount} pedidos</strong> à base de dados.
            </p>
          </div>

          {importResults.rejectedCount > 0 && (
            <div className="max-w-md mx-auto text-left p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
              <span className="font-bold text-amber-900">
                {importResults.rejectedCount} registros rejeitados para evitar duplicidade:
              </span>
              <ul className="list-disc pl-4 space-y-1 text-amber-800">
                {importResults.rejectedDetails.slice(0, 5).map((d, i) => (
                  <li key={i}>
                    Linha {d.row}: {d.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setStep(1);
                setImportResults(null);
              }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Importar Outro Arquivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
