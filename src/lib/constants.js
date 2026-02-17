export const DEFAULT_EXPENSE_CATS = [
  { id: 'alimentacao', name: 'Alimentação', icon: '🍽️', budget: 1500 },
  { id: 'transporte', name: 'Transporte', icon: '🚗', budget: 800 },
  { id: 'moradia', name: 'Moradia', icon: '🏠', budget: 3000 },
  { id: 'saude', name: 'Saúde', icon: '💊', budget: 500 },
  { id: 'educacao', name: 'Educação', icon: '📚', budget: 400 },
  { id: 'lazer', name: 'Lazer', icon: '🎮', budget: 600 },
  { id: 'vestuario', name: 'Vestuário', icon: '👔', budget: 400 },
  { id: 'servicos', name: 'Serviços', icon: '⚡', budget: 500 },
  { id: 'outros', name: 'Outros', icon: '📦', budget: 300 },
];

export const DEFAULT_INCOME_CATS = [
  { id: 'salario', name: 'Salário', icon: '💰' },
  { id: 'freelance', name: 'Freelance', icon: '💻' },
  { id: 'rendimentos', name: 'Rendimentos', icon: '📈' },
  { id: 'outros_renda', name: 'Outros', icon: '💵' },
];

export const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
export const genId = () => Math.random().toString(36).slice(2, 10);

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
