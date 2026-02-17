export const CATEGORIES = [
  { id: 'alimentacao', name: 'Alimentação', icon: '🍽️', color: '#FF6B9D', budget: 1500 },
  { id: 'transporte', name: 'Transporte', icon: '🚗', color: '#00E5FF', budget: 800 },
  { id: 'moradia', name: 'Moradia', icon: '🏠', color: '#7C4DFF', budget: 3000 },
  { id: 'saude', name: 'Saúde', icon: '💊', color: '#69F0AE', budget: 500 },
  { id: 'educacao', name: 'Educação', icon: '📚', color: '#FFD740', budget: 400 },
  { id: 'lazer', name: 'Lazer', icon: '🎮', color: '#E040FB', budget: 600 },
  { id: 'vestuario', name: 'Vestuário', icon: '👔', color: '#FF9100', budget: 400 },
  { id: 'servicos', name: 'Serviços', icon: '⚡', color: '#40C4FF', budget: 500 },
  { id: 'investimentos', name: 'Investimentos', icon: '📈', color: '#B2FF59', budget: 2000 },
  { id: 'outros', name: 'Outros', icon: '📦', color: '#B388FF', budget: 300 },
];

export const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export const formatBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const genId = () => Math.random().toString(36).slice(2, 10);

export const getCategoryByDesc = (desc) => {
  const d = (desc || '').toLowerCase();
  const rules = [
    { keys: ['mercado','supermercado','ifood','restaurante','padaria','lanchonete','açougue','hortifruti','pizza','burger','mcdonald','subway','starbucks','café','aliment'], cat: 'alimentacao' },
    { keys: ['uber','99','cabify','combustível','gasolina','etanol','estacionamento','pedágio','ônibus','metrô','passagem','shell','ipiranga','br distribuidora'], cat: 'transporte' },
    { keys: ['aluguel','condomínio','iptu','imobiliária','reforma','mudança','mobília'], cat: 'moradia' },
    { keys: ['farmácia','hospital','médico','dentista','plano de saúde','unimed','amil','consulta','exame','laboratório','drogaria'], cat: 'saude' },
    { keys: ['curso','escola','faculdade','udemy','coursera','livro','papelaria','mensalidade'], cat: 'educacao' },
    { keys: ['netflix','spotify','cinema','teatro','show','jogo','game','steam','playstation','xbox','bar','festa','viagem','hotel'], cat: 'lazer' },
    { keys: ['roupa','renner','c&a','zara','riachuelo','calçado','tênis','nike','adidas','havan'], cat: 'vestuario' },
    { keys: ['energia','água','gás','internet','celular','telefone','vivo','claro','tim','cemig','caesb','sabesp','luz','conta de'], cat: 'servicos' },
    { keys: ['investimento','tesouro','ação','fundo','cdb','lci','lca','poupança','bitcoin','cripto','renda fixa'], cat: 'investimentos' },
  ];
  for (const rule of rules) {
    if (rule.keys.some(k => d.includes(k))) return rule.cat;
  }
  return 'outros';
};

export const defaultAccounts = [
  { id: '1', name: 'Nubank', type: 'Conta Corrente', balance: 4523.87, color: '#B24DFF', connected: true, icon: '💜' },
  { id: '2', name: 'Banco do Brasil', type: 'Conta Corrente', balance: 12350.00, color: '#FFD740', connected: true, icon: '🟡' },
  { id: '3', name: 'Rico Investimentos', type: 'Investimentos', balance: 45000.00, color: '#FF6D00', connected: true, icon: '🔶' },
];
