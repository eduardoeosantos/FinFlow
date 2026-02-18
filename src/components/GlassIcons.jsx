'use client';

// FinFlow Liquid Glass Icon System v2
// Refined thin-stroke SVGs · 24×24 viewBox · strokeWidth 1.5 · round caps/joins

export const GLASS_ICONS = {
  // ═══ Finanças ═══
  wallet:     { d: 'M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 3H8l-2 4h12l-2-4zm0 11a1.5 1.5 0 110 .01', l:'Carteira' },
  money:      { d: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7', l:'Dinheiro' },
  card:       { d: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 3h18M7 15h4', l:'Cartão' },
  bank:       { d: 'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m4-11v11m4-11v11m4-11v11m4-11v11', l:'Banco' },
  chart_up:   { d: 'M3 3v18h18M7 14l4-4 4 4 5-6', l:'Gráfico' },
  chart_bar:  { d: 'M3 3v18h18M7 17v-4m4 4V9m4 8V5m4 12V7', l:'Barras' },
  invest:     { d: 'M2 20l5.5-5.5 4 4L22 8M16 8h6v6', l:'Investimento' },
  coins:      { d: 'M9 14a5 5 0 110-10 5 5 0 010 10zm0 0v1a3 3 0 003 3h3a5 5 0 000-10', l:'Moedas' },
  receipt:    { d: 'M6 2h12a1 1 0 011 1v18l-2.5-2L14 21l-2-2-2 2-2.5-2L5 21V3a1 1 0 011-1zM9 7h6m-6 4h6m-6 4h3', l:'Recibo' },
  piggy:      { d: 'M19 11a1 1 0 110 2M3 11l-1 4m18-5a7 7 0 01-7 7H9a7 7 0 01-7-7 7 7 0 017-7h1l1.5 2.5M12 4V2', l:'Cofrinho' },
  safe:       { d: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm8 5a3 3 0 100 6 3 3 0 000-6zm0 1v4m-2-2h4', l:'Cofre' },
  transfer:   { d: 'M7 10l-4 4m0 0l4 4M3 14h18m-4-4l4-4m0 0l-4-4m4 4H3', l:'Transferência' },
  percent:    { d: 'M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm11 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z', l:'Porcentagem' },
  calculator: { d: 'M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm3 4h10v4H7V6zm0 7h2m4 0h2m-8 3h2m4 0h2', l:'Calculadora' },
  pix:        { d: 'M13.17 10.83l4.24-4.24a2 2 0 012.83 0l.71.7a2 2 0 010 2.84l-4.24 4.24m-3.54-3.54L9.93 14.07a2 2 0 01-2.83 0l-.7-.71a2 2 0 010-2.83l4.23-4.24m2.54 3.54L12 11', l:'PIX' },
  trending:   { d: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6', l:'Tendência' },
  dollar:     { d: 'M12 1v22m5-18H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7', l:'Dólar' },
  briefcase:  { d: 'M2 8a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V8zM8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 7h8', l:'Trabalho' },

  // ═══ Casa ═══
  house:      { d: 'M3 12l9-8 9 8M5 10v10a1 1 0 001 1h3v-5a1 1 0 011-1h4a1 1 0 011 1v5h3a1 1 0 001-1V10', l:'Casa' },
  building:   { d: 'M3 21h18M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16m0 0h4V11l-4-2M9 7h1m-1 4h1m-1 4h1', l:'Prédio' },
  key:        { d: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4', l:'Chave' },
  lightbulb:  { d: 'M9 18h6m-5 3h4M12 2a7 7 0 00-4 12.74V17h8v-2.26A7 7 0 0012 2z', l:'Luz' },
  droplet:    { d: 'M12 2.69l5.66 5.66a8 8 0 11-11.31 0L12 2.69z', l:'Água' },
  wifi:       { d: 'M12 20h.01M8.53 16.11a6 6 0 016.95 0M5.64 12.74a10 10 0 0112.72 0M2.05 9.35a14 14 0 0119.9 0', l:'Internet' },
  plug:       { d: 'M12 22v-4m-4 0h8M8 18V9m8 9V9M7 2v5m10-5v5M9 9h6', l:'Elétrica' },
  flame:      { d: 'M12 22c4-3 7-6.5 7-10a7 7 0 00-14 0c0 3.5 3 7 7 10z', l:'Gás' },
  bed:        { d: 'M3 20v-8m18 8v-8M3 12h18M3 12V7a2 2 0 012-2h14a2 2 0 012 2v5M7 12v-2a2 2 0 012-2h0a2 2 0 012 2v2', l:'Quarto' },
  sofa:       { d: 'M4 11V7a2 2 0 012-2h12a2 2 0 012 2v4M2 11v6a2 2 0 002 2h16a2 2 0 002-2v-6a2 2 0 00-4 0H6a2 2 0 00-4 0z', l:'Sala' },

  // ═══ Transporte ═══
  car:        { d: 'M7 17a2 2 0 11-4 0 2 2 0 014 0zm14 0a2 2 0 11-4 0 2 2 0 014 0zM5 17H3v-4l2-6h14l2 6v4h-2m-12 0h8', l:'Carro' },
  fuel:       { d: 'M3 22V5a2 2 0 012-2h8a2 2 0 012 2v12m0-11l3-1a1 1 0 011 1v9a2 2 0 01-2 2h-2M5 22h10M7 7h4v3H7V7z', l:'Combustível' },
  bus:        { d: 'M7 20a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2zM3 17V7a4 4 0 014-4h10a4 4 0 014 4v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 12h18M8 16h.01m8 0h.01', l:'Ônibus' },
  plane:      { d: 'M17.8 3.8l2.4 2.4-3.2 3.2 2 5.6-1.4 1.4-3.6-4.2-3.2 3.2.4 2.8-1.4 1.4L8.4 16l-3.6 1.4L3.4 16 4.8 12.4 16 1.2', l:'Avião' },
  bike:       { d: 'M5.5 18a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm13 0a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5.5 14.5l5-8h4.5l2.5 5m-7.5 3l5-3', l:'Bicicleta' },
  motorcycle: { d: 'M5 18a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zM5 15l4-9h3l3 6m-8 0h12', l:'Moto' },
  truck:      { d: 'M1 3h15v13H1V3zm15 7h4l3 4v2h-7V10zM5.5 19.5a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z', l:'Entrega' },
  parking:    { d: 'M3 3h18v18H3V3zm6 4v10m0-10h3a3 3 0 010 6H9', l:'Estacionar' },

  // ═══ Alimentação ═══
  utensils:   { d: 'M3 2v7c0 1.1.9 2 2 2h2a2 2 0 002-2V2m-3 0v20m14-18a4 4 0 00-4 4v1a2 2 0 002 2h0a2 2 0 002-2V2m-2 20V11', l:'Restaurante' },
  cart:       { d: 'M2 2h3l2.6 13a2 2 0 002 1.6h7.7a2 2 0 002-1.6L22 6H6m4 15a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm9 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z', l:'Supermercado' },
  coffee:     { d: 'M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zm3-6v3m4-3v3m4-3v3', l:'Café' },
  apple:      { d: 'M12 3a5 5 0 00-5 5c0 4 2 8 5 11 3-3 5-7 5-11a5 5 0 00-5-5zm0 0c1.5-2 3-3 5-3', l:'Alimento' },
  beer:       { d: 'M17 8h4v8a2 2 0 01-2 2h-2M5 2h10a1 1 0 011 1v15a2 2 0 01-2 2H6a2 2 0 01-2-2V3a1 1 0 011-1zm0 6h10', l:'Bar' },
  pizza:      { d: 'M12 2L2 19.5h20L12 2zm0 6v.01m-3 5v.01m5-2v.01', l:'Pizza' },
  meat:       { d: 'M15.5 2.5c4 4 4 10 0 14s-10 4-14 0M18 6l-2 2M6 18l-2 2m6-8a2 2 0 110-4 2 2 0 010 4z', l:'Churrasco' },

  // ═══ Saúde ═══
  heart:      { d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z', l:'Saúde' },
  pill:       { d: 'M10.5 3.5a7 7 0 019.9 9.9l-6 6a7 7 0 01-9.9-9.9l6-6zm-3 10l7-7', l:'Remédio' },
  hospital:   { d: 'M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M10 7h4m-2-2v4m-5 5h2m4 0h2m-8 3h2m4 0h2', l:'Hospital' },
  activity:   { d: 'M22 12h-4l-3 9L9 3l-3 9H2', l:'Atividade' },
  shield_plus:{ d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12h6m-3-3v6', l:'Plano Saúde' },
  dumbbell:   { d: 'M6.5 6.5l11 11M5 12h14M2 9.5v5m4-7v9m12-9v9m4-7v5', l:'Academia' },

  // ═══ Educação ═══
  book:       { d: 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2V3zm20 0h-6a4 4 0 00-4 4v14a3 3 0 013-3h7V3z', l:'Livro' },
  graduation: { d: 'M22 10l-10-5L2 10l10 5 10-5zm-10 5v6M6 12v4c3 3 9 3 12 0v-4', l:'Formatura' },
  pencil:     { d: 'M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z', l:'Estudo' },
  laptop:     { d: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v8H4V6zM2 18h20v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-1z', l:'Notebook' },
  school:     { d: 'M22 10l-10-5L2 10M6 12v5a2 2 0 002 2h8a2 2 0 002-2v-5', l:'Escola' },

  // ═══ Lazer ═══
  gamepad:    { d: 'M6 11h4m-2-2v4m5.5-.5h.01m3-3h.01M2 12a4 4 0 014-4h12a4 4 0 014 4v0a4 4 0 01-4 4H6a4 4 0 01-4-4z', l:'Game' },
  music:      { d: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z', l:'Música' },
  film:       { d: 'M7 2v20m10-20v20M2 12h20M2 7h5m10 0h5M2 17h5m10 0h5M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z', l:'Cinema' },
  map_pin:    { d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z', l:'Viagem' },
  ball:       { d: 'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10M12 2a15.3 15.3 0 00-4 10 15.3 15.3 0 004 10', l:'Esporte' },
  palette:    { d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.75 1.5-1.5 0-.39-.15-.74-.39-1.02A1.5 1.5 0 0114.24 17H16c3.31 0 6-2.69 6-6 0-5.52-4.48-9.96-10-9.96z', l:'Arte' },
  camera:     { d: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11zM12 17a4 4 0 100-8 4 4 0 000 8z', l:'Foto' },
  headphones: { d: 'M3 18v-6a9 9 0 0118 0v6M3 18a3 3 0 003 3h0a1 1 0 001-1v-4a1 1 0 00-1-1H3zm18 0a3 3 0 01-3 3h0a1 1 0 01-1-1v-4a1 1 0 011-1h3z', l:'Podcast' },
  tent:       { d: 'M3 21h18L12 3 3 21zm9-18v18m-4.5-6L12 9l4.5 6', l:'Camping' },
  mountain:   { d: 'M2 20h20L14 4l-3 6-3-2-6 12z', l:'Aventura' },

  // ═══ Vestuário ═══
  shirt:      { d: 'M7 2L2 7l3 3 2-2v12h10V8l2 2 3-3-5-5-3 2h-4L7 2z', l:'Roupa' },
  bag:        { d: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zm0 4h12M16 10a4 4 0 01-8 0', l:'Compras' },
  gem:        { d: 'M6 3h12l4 7-10 11L2 10l4-7zm-4 7h20M8 10l4 11m4-11l-4 11', l:'Joia' },
  scissors:   { d: 'M6 9a3 3 0 100-6 3 3 0 000 6zm12 12a3 3 0 100-6 3 3 0 000 6zM6 9l12 12M20 4L8.12 15.88', l:'Beleza' },
  shoe:       { d: 'M2 16l2-3c1-1.5 3-2 5-2h6a4 4 0 014 4v1a2 2 0 01-2 2H4a2 2 0 01-2-2v0z', l:'Calçado' },
  crown:      { d: 'M2 17h20l-2-10-4 4-4-6-4 6-4-4-2 10zm0 3h20', l:'Luxo' },

  // ═══ Serviços ═══
  bolt:       { d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z', f:true, l:'Energia' },
  phone:      { d: 'M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm5 18h.01', l:'Celular' },
  wrench:     { d: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z', l:'Manutenção' },
  cloud:      { d: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z', l:'Nuvem' },
  shield:     { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', l:'Seguro' },
  monitor:    { d: 'M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM8 20h8m-4-2v2', l:'TV/Stream' },
  antenna:    { d: 'M12 14a2 2 0 100-4 2 2 0 000 4zm0 0v8M8.11 8.11a6 6 0 000 7.78m7.78-7.78a6 6 0 010 7.78', l:'Assinatura' },
  broom:      { d: 'M12 2v8M7 12l5-2 5 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6z', l:'Limpeza' },

  // ═══ Família & Pets ═══
  paw:        { d: 'M12 21c-1.5-1.5-6-5-6-9a4 4 0 018 0c0 4-4.5 7.5-6 9zM7.5 8a2 2 0 100-4 2 2 0 010 4zm9 0a2 2 0 100-4 2 2 0 010 4zM5 4.5a1.5 1.5 0 100-3 1.5 1.5 0 010 3zm14 0a1.5 1.5 0 100-3 1.5 1.5 0 010 3z', l:'Pet' },
  baby:       { d: 'M12 2a10 10 0 100 20 10 10 0 000-20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01', l:'Bebê' },
  users:      { d: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', l:'Família' },

  // ═══ Geral ═══
  star:       { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', l:'Estrela' },
  gift:       { d: 'M20 12v10H4V12m8 10V12m-8 0h16M12 7a3 3 0 01-3-3c0-1 .5-2 2-2s2.5 2 1 5zm0 0a3 3 0 003-3c0-1-.5-2-2-2s-2.5 2-1 5zM4 7h16v5H4V7z', l:'Presente' },
  tag:        { d: 'M7 7h.01M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z', l:'Tag' },
  clock:      { d: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 5v5l3 3', l:'Relógio' },
  box:        { d: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12', l:'Outros' },
  bell:       { d: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0', l:'Sino' },
  bookmark:   { d: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z', l:'Favorito' },
  globe:      { d: 'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z', l:'Global' },
  sun:        { d: 'M12 8a4 4 0 100 8 4 4 0 000-8zm0-6v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41', l:'Sol' },
  sparkle:    { d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z', l:'Brilho' },
  target:     { d: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 4a2 2 0 100 4 2 2 0 000-4z', l:'Meta' },
  flag:       { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7', l:'Marco' },
  archive:    { d: 'M3 3h18v4H3V3zm1 4v12a2 2 0 002 2h12a2 2 0 002-2V7M10 12h4', l:'Arquivo' },
  recycle:    { d: 'M7 19H2l5-8m10 8h5l-5-8M12 2l5 8H7l5-8', l:'Reciclagem' },
  leaf:       { d: 'M17 8c.5-5-5.5-7-11-5a1 1 0 00-.7.7c-2 5.5 0 11.5 5 11M7 21l4.5-4.5M12 12l-4.5 4.5', l:'Ecológico' },
  zap:        { d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z', l:'Raio' },
  diamond:    { d: 'M12 2l8 10-8 10-8-10 8-10z', l:'Diamante' },
  hex:        { d: 'M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z', l:'Hexágono' },
  circle:     { d: 'M12 2a10 10 0 100 20 10 10 0 000-20z', l:'Círculo' },
  check:      { d: 'M20 6L9 17l-5-5', l:'Concluído' },
  plus:       { d: 'M12 5v14m-7-7h14', l:'Adicionar' },
  heart2:     { d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3.5.93-4.5 2.57A5.5 5.5 0 007.5 3 5.5 5.5 0 002 8.5c0 2.3 1.5 4.04 3 5.5l7 7 7-7z', l:'Amor' },

  // ═══ Navegação ═══
  nav_grid:   { d: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z', l:'Dashboard' },
  nav_list:   { d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', l:'Lista' },
  nav_scan:   { d: 'M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M8 12h8m-4-4v8', l:'Escanear' },
  nav_down:   { d: 'M12 3v12m0 0l-4-4m4 4l4-4M5 19h14', l:'Importar' },
  nav_pie:    { d: 'M21.21 15.89A10 10 0 118.11 2.79M22 12A10 10 0 0012 2v10h10z', l:'Orçamento' },
  nav_trend:  { d: 'M3 17l6-6 4 4 8-8M14 7h7v7', l:'Forecast' },
  nav_diamond:{ d: 'M12 2l8 10-8 10-8-10 8-10z', l:'Patrimônio' },
  nav_gear:   { d: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.43-2.5a1.6 1.6 0 00.32 1.77l.05.05a2 2 0 01-2.83 2.83l-.05-.05a1.6 1.6 0 00-2.72 1.14V19a2 2 0 01-4 0v-.08a1.6 1.6 0 00-1.05-1.47 1.6 1.6 0 00-1.77.32l-.05.05a2 2 0 01-2.83-2.83l.05-.05a1.6 1.6 0 00-.45-2.72H3a2 2 0 010-4h.08a1.6 1.6 0 001.47-1.05 1.6 1.6 0 00-.32-1.77l-.05-.05a2 2 0 012.83-2.83l.05.05A1.6 1.6 0 009.78 5H10V3a2 2 0 014 0v.08a1.6 1.6 0 001.05 1.47 1.6 1.6 0 001.77-.32l.05-.05a2 2 0 012.83 2.83l-.05.05a1.6 1.6 0 00.45 2.72H21a2 2 0 010 4h-.08a1.6 1.6 0 00-1.47 1.05z', l:'Config' },
};

// Navigation mapping
export const NAV_ICON_MAP = {
  dashboard: 'nav_grid', transactions: 'nav_list', scan: 'nav_scan',
  import: 'nav_down', budget: 'nav_pie', forecast: 'nav_trend',
  patrimonio: 'nav_diamond', settings: 'nav_gear',
};

// Groups for picker
export const GLASS_ICON_GROUPS = [
  { label: 'Finanças', keys: ['wallet','money','card','bank','chart_up','chart_bar','invest','coins','receipt','piggy','safe','transfer','percent','calculator','pix','trending','dollar','briefcase'] },
  { label: 'Casa', keys: ['house','building','key','lightbulb','droplet','wifi','plug','flame','bed','sofa'] },
  { label: 'Transporte', keys: ['car','fuel','bus','plane','bike','motorcycle','truck','parking'] },
  { label: 'Alimentação', keys: ['utensils','cart','coffee','apple','beer','pizza','meat'] },
  { label: 'Saúde', keys: ['heart','pill','hospital','activity','shield_plus','dumbbell'] },
  { label: 'Educação', keys: ['book','graduation','pencil','laptop','school'] },
  { label: 'Lazer', keys: ['gamepad','music','film','map_pin','ball','palette','camera','headphones','tent','mountain'] },
  { label: 'Vestuário', keys: ['shirt','bag','gem','scissors','shoe','crown'] },
  { label: 'Serviços', keys: ['bolt','phone','wrench','cloud','shield','monitor','antenna','broom'] },
  { label: 'Família', keys: ['paw','baby','users'] },
  { label: 'Geral', keys: ['star','gift','tag','clock','box','bell','bookmark','globe','sun','sparkle','target','flag','archive','recycle','leaf','zap','heart2','diamond','hex','circle','check','plus'] },
];

// Emoji fallback groups
export const EMOJI_GROUPS = [
  { label: 'Finanças', icons: ['💰','💳','💵','💎','🏦','📊','📈','💹','🪙','🧾','💸','📉'] },
  { label: 'Casa', icons: ['🏠','🏡','🏢','🔑','💡','🔌','🧹','🛁','🪣'] },
  { label: 'Transporte', icons: ['🚗','🏍️','🚌','✈️','🚲','⛽','🛵','🚂'] },
  { label: 'Alimentação', icons: ['🍽️','🛒','☕','🍕','🍔','🥩','🍺','🍷'] },
  { label: 'Saúde', icons: ['💊','🏥','🩺','❤️','🏃','💪','🧘'] },
  { label: 'Educação', icons: ['📚','🎓','📝','🖥️','🔬','🏫'] },
  { label: 'Lazer', icons: ['🎮','🎬','🎵','⚽','🎨','📷','🎧','⛺','🏔️'] },
  { label: 'Outros', icons: ['📦','🎁','🐾','👶','✨','🔔','🏷️','⭐','🌍','♻️','🍃','⚡','👑','👟'] },
];

// ── SVG Renderer with Liquid Glass style ──
export function GlassIcon({ icon, size = 20, color = 'rgba(255,255,255,0.7)', glow, style }) {
  const def = GLASS_ICONS[icon];
  if (!def) {
    return (
      <span style={{ fontSize: size * 0.8, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, ...style }}>
        {icon}
      </span>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ flexShrink: 0, ...style, filter: glow ? `drop-shadow(0 0 4px ${glow})` : undefined }}>
      {def.f
        ? <path d={def.d} fill={color} opacity="0.85" />
        : <path d={def.d} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      }
    </svg>
  );
}

// Universal render: glass key → SVG, else → emoji span
export function renderIcon(icon, size = 20, color = 'rgba(255,255,255,0.7)', glow) {
  if (!icon) return null;
  if (GLASS_ICONS[icon]) return <GlassIcon icon={icon} size={size} color={color} glow={glow} />;
  return (
    <span style={{ fontSize: size * 0.8, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      {icon}
    </span>
  );
}
