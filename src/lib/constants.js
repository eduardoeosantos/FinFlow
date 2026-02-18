export const DEFAULT_EXPENSE_CATS = [
  { id: 'alimentacao', name: 'Alimentação', icon: 'utensils', budgetType: 'monthly', monthlyBudget: 1500, annualBudget: {} },
  { id: 'transporte', name: 'Transporte', icon: 'car', budgetType: 'monthly', monthlyBudget: 800, annualBudget: {} },
  { id: 'moradia', name: 'Moradia', icon: 'house', budgetType: 'monthly', monthlyBudget: 3000, annualBudget: {} },
  { id: 'saude', name: 'Saúde', icon: 'pill', budgetType: 'monthly', monthlyBudget: 500, annualBudget: {} },
  { id: 'educacao', name: 'Educação', icon: 'book', budgetType: 'monthly', monthlyBudget: 400, annualBudget: {} },
  { id: 'lazer', name: 'Lazer', icon: 'gamepad', budgetType: 'monthly', monthlyBudget: 600, annualBudget: {} },
  { id: 'vestuario', name: 'Vestuário', icon: 'shirt', budgetType: 'annual', monthlyBudget: 400, annualBudget: { 1: 200, 2: 0, 3: 300, 4: 0, 5: 0, 6: 500, 7: 0, 8: 0, 9: 200, 10: 0, 11: 0, 12: 600 } },
  { id: 'servicos', name: 'Serviços', icon: 'bolt', budgetType: 'monthly', monthlyBudget: 500, annualBudget: {} },
  { id: 'outros', name: 'Outros', icon: 'box', budgetType: 'monthly', monthlyBudget: 300, annualBudget: {} },
];

export const DEFAULT_INCOME_CATS = [
  { id: 'salario', name: 'Salário', icon: 'money', budgetType: 'monthly', monthlyBudget: 12000, annualBudget: {} },
  { id: 'freelance', name: 'Freelance', icon: 'laptop', budgetType: 'annual', monthlyBudget: 0, annualBudget: {} },
  { id: 'rendimentos', name: 'Rendimentos', icon: 'chart_up', budgetType: 'monthly', monthlyBudget: 0, annualBudget: {} },
  { id: 'outros_renda', name: 'Outros', icon: 'coins', budgetType: 'annual', monthlyBudget: 0, annualBudget: {} },
];

export const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
export const genId = () => Math.random().toString(36).slice(2, 10);

/**
 * Get the budget for a category in a specific month (1-12).
 */
export function getCatBudget(cat, month) {
  if (!cat) return 0;
  if (cat.budgetType === 'annual' && cat.annualBudget) {
    return cat.annualBudget[month] || 0;
  }
  return cat.monthlyBudget || 0;
}

/**
 * Get total budget for a category across a range of months.
 * months = array of { month: 1-12, year: YYYY }
 */
export function getCatBudgetRange(cat, months) {
  if (!cat) return 0;
  return months.reduce((sum, m) => sum + getCatBudget(cat, m.month), 0);
}

export const getCategoryByDesc = (desc) => {
  const d = (desc || '').toLowerCase();
  const rules = [
    { keys: ['mercado','supermercado','ifood','restaurante','padaria','lanchonete','açougue','pizza','burger','café','aliment'], cat: 'alimentacao' },
    { keys: ['uber','99','combustível','gasolina','estacionamento','pedágio','ônibus','metrô','shell'], cat: 'transporte' },
    { keys: ['aluguel','condomínio','iptu','imobiliária','reforma'], cat: 'moradia' },
    { keys: ['farmácia','hospital','médico','dentista','plano de saúde','unimed','amil','drogaria'], cat: 'saude' },
    { keys: ['curso','escola','faculdade','udemy','livro','mensalidade'], cat: 'educacao' },
    { keys: ['netflix','spotify','cinema','teatro','show','jogo','game','steam','bar','viagem','hotel'], cat: 'lazer' },
    { keys: ['roupa','renner','c&a','zara','riachuelo','calçado','tênis'], cat: 'vestuario' },
    { keys: ['energia','água','gás','internet','celular','telefone','vivo','claro','tim','cemig','luz'], cat: 'servicos' },
  ];
  for (const rule of rules) { if (rule.keys.some(k => d.includes(k))) return rule.cat; }
  return 'outros';
};
