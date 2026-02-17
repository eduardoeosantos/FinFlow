# 🚀 FinFlow — Gestão Financeira Pessoal

App completo de finanças pessoais com Glassmorphism, scanner de recibos com IA e forecast inteligente.

---

## 📋 Passo a passo para rodar no seu computador

### 1. Instalar o Node.js
1. Acesse [nodejs.org](https://nodejs.org)
2. Baixe a versão **LTS** (botão verde)
3. Instale normalmente (próximo, próximo, concluir)
4. Reinicie o computador

### 2. Abrir o Terminal
- **Windows:** Pressione `Win + R`, digite `cmd` e aperte Enter
- **Mac:** Pressione `Cmd + Espaço`, digite `Terminal` e aperte Enter

### 3. Navegar até a pasta do projeto
```bash
cd caminho/para/a/pasta/finflow
```

> 💡 **Dica Windows:** Abra a pasta no Explorador de Arquivos, clique na barra de endereço, digite `cmd` e aperte Enter. O terminal já abre na pasta certa!

### 4. Instalar as dependências
```bash
npm install
```
Aguarde ~1-2 minutos. Vai baixar todas as bibliotecas necessárias.

### 5. Rodar o app
```bash
npm run dev
```

### 6. Acessar
Abra o navegador e acesse: **http://localhost:3000**

🎉 Pronto! O FinFlow está rodando!

---

## 🌐 Publicar na internet (Vercel)

### 1. Criar conta no GitHub
1. Acesse [github.com](https://github.com) → Sign up
2. Crie o repositório "finflow"
3. Suba os arquivos (pode usar o GitHub Desktop para facilitar)

### 2. Publicar na Vercel
1. Acesse [vercel.com](https://vercel.com) → Sign up com GitHub
2. Clique em "New Project"
3. Selecione o repositório "finflow"
4. Clique em "Deploy"
5. Aguarde ~2 minutos
6. Seu app estará em: `finflow-seuusuario.vercel.app`

---

## 📱 Instalar no celular (PWA)

Depois de publicar na Vercel:

**iPhone (Safari):**
1. Abra o site no Safari
2. Toque no botão de compartilhar ⬆️
3. "Adicionar à Tela de Início"

**Android (Chrome):**
1. Abra o site no Chrome
2. Banner automático "Adicionar à tela inicial" ou
3. Menu ⋮ → "Instalar aplicativo"

---

## 📂 Estrutura do projeto

```
finflow/
├── package.json          ← Dependências
├── next.config.js        ← Configuração Next.js + PWA
├── jsconfig.json         ← Aliases de importação
├── public/
│   ├── manifest.json     ← Configuração PWA
│   └── icons/            ← Ícones do app
├── src/
│   ├── app/
│   │   ├── layout.js     ← Layout raiz (meta tags)
│   │   ├── page.js       ← Página principal
│   │   └── globals.css   ← Estilos globais (Glassmorphism)
│   ├── components/
│   │   └── FinFlowApp.jsx ← Componente principal do app
│   └── lib/
│       ├── constants.js   ← Categorias e helpers
│       ├── storage.js     ← Persistência (localStorage)
│       ├── forecast.js    ← Motor de previsão
│       └── importParser.js ← Parser CSV/OFX
```

---

## 📥 Importação de dados

O app aceita extratos bancários nos formatos:

| Formato | Bancos testados |
|---------|----------------|
| CSV     | Nubank, Banco do Brasil, Itaú, Santander |
| OFX     | Todos os bancos brasileiros |
| QFX     | Variante do OFX (compatível) |

### Fluxo:
1. Exporte o extrato do seu banco (CSV ou OFX)
2. No FinFlow, vá em **Importar**
3. Arraste o arquivo ou clique para selecionar
4. Revise cada transação (categoria, valor)
5. Aprove ✓ ou rejeite ✕ individualmente ou em massa
6. Clique em **Confirmar** para lançar

---

## 🛠 Tecnologias

- **Next.js 14** — Framework React
- **PWA** — Funciona como app nativo
- **Claude AI** — Scanner de recibos
- **PapaParse** — Parser de CSV
- **localStorage** — Persistência de dados

---

*Desenvolvido com ❤️ e Claude AI — 2026*
