# Redesign da Landing Page + Camada de Feedback — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer a landing page pública do Forex IA Studio — copy, tipografia, paleta, ícones, logo e animação — e adicionar uma camada de feedback animada (toast, botão com carregamento, skeleton, progresso) usada também pelas telas do sistema.

**Architecture:** O front-end é um único React SPA denso em `src/main.tsx`, sem roteador e sem componentes em arquivos separados. Este trabalho extrai três módulos novos apenas nas fronteiras que ele mesmo cria — `src/brand.tsx` (marca), `src/landing.tsx` (landing) e `src/feedback.tsx` (feedback) — e deixa o resto de `main.tsx` intacto. Todos os estilos continuam em `src/styles.css`, em blocos comentados por área. Nenhuma rota, contrato de API ou arquivo de backend muda.

**Tech Stack:** React 18, Vite 5, TypeScript (só transpilação, sem typecheck), `lucide-react` (já instalado), `@fontsource` (a instalar), CSS puro em arquivo único.

## Global Constraints

Estas regras valem para **todas** as tarefas. Toda tarefa herda esta seção.

- **Nunca edite `/main.tsx`, `/styles.css` na raiz nem nada em `patch/`.** São cópias obsoletas, fora do build. O código real é `src/main.tsx` e `src/styles.css`.
- **Não toque em `server.cjs`, `billing/`, `v2/`, `mt5/`, `supabase/` nem em qualquer rota.** Este trabalho é 100% front-end.
- **Estilo de código:** `src/main.tsx` é deliberadamente denso — componentes em uma linha, sem espaçamento idiomático de React. Os arquivos novos devem seguir o mesmo estilo. Não reformate código existente.
- **Idioma:** toda string de interface e todo comentário em português do Brasil. Números e moeda com `toLocaleString('pt-BR', ...)`.
- **Chamadas de API:** sempre pelo helper `api()` de `src/main.tsx`. Nunca `fetch` direto.
- **Preços (fonte da verdade: `billing/routes.cjs:6`):** criar robô R$ 0,26 por indicador, backtest R$ 0,10 por indicador, otimizador R$ 0,50 por indicador. A landing não pode citar outros valores.
- **Sem prova social inventada.** Nada de "10.000 traders", depoimentos fictícios ou logos de empresas. Só fatos verificáveis sobre o produto.
- **Acessibilidade obrigatória:** foco visível em todo controle, alvo de toque mínimo de 44px, `@media (prefers-reduced-motion: reduce)` desligando toda animação, e nenhum scroll horizontal em 375px.
- **Tokens de cor e movimento vêm de `:root`.** Nenhum hex solto e nenhuma duração/curva literal em regra nova — use as variáveis definidas na Tarefa 1.
- **Não existe teste automatizado, lint ou typecheck no projeto.** A verificação é sempre pelo navegador com o servidor rodando. Cada tarefa diz exatamente o que checar.
- **Commits frequentes**, um por tarefa, em português, no formato `tipo: descrição`.

## Como rodar e verificar

O projeto sobe com `npm start` (Express na 3001 + Vite na 5173). Use as ferramentas de preview do navegador em vez de rodar servidor pelo shell:

- Abrir: `preview_start` com o nome de configuração `dev` (crie `.claude/launch.json` na Tarefa 1 se não existir).
- Erros de front: `read_console_messages` com `onlyErrors: true`.
- Erros de servidor/build: `preview_logs` com `level: "error"`.
- Conteúdo e estrutura: `read_page`.
- Responsivo: `resize_window` com preset `mobile` / `tablet` / `desktop`, recarregando depois.
- Prova visual: `computer` com `action: "screenshot"`.

A landing é a primeira tela sem sessão (`src/main.tsx:1131`), então basta abrir `http://localhost:5173` deslogado para vê-la. Se houver sessão salva, limpe com `localStorage.removeItem('fia_session')` via `javascript_tool` e recarregue.

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `.claude/launch.json` | Configuração de dev server para o preview | 1 |
| `src/styles.css` (topo) | Tokens de cor, tipografia e movimento | 1 |
| `src/brand.tsx` | **Criar.** Símbolo, wordmark e favicon. Sem dependências internas. | 2 |
| `index.html` | Favicon e meta | 2 |
| `src/landing.tsx` | **Criar.** Componente `Landing` + dados de conteúdo. | 3–6 |
| `src/main.tsx` | Perde `Landing` e os arrays `LP_*`; ganha imports e a camada de feedback | 3, 8 |
| `src/feedback.tsx` | **Criar.** `ToastProvider`, `useToast`, `LoadingButton`, `Skeleton`, `ProgressBar`. | 7 |

---

### Task 1: Tokens de cor, tipografia e movimento

Base de tudo. Nenhuma outra tarefa pode começar antes desta, porque todas consomem estas variáveis.

**Files:**
- Create: `.claude/launch.json`
- Modify: `src/styles.css:1` (bloco `:root`)
- Modify: `src/main.tsx:1` (linha de imports — adicionar imports de fonte)
- Modify: `package.json` (dependências de fonte)

**Interfaces:**
- Consumes: nada.
- Produces: as variáveis CSS `--bg`, `--surface`, `--surface-2`, `--line`, `--cy-500`, `--cyan`, `--txt`, `--muted`, `--green`, `--red`, `--font-display`, `--font-body`, `--font-mono`, `--e-out`, `--e-in-out`, `--t-1`, `--t-2`, `--t-3`, `--t-4`; e as classes utilitárias `.num` (números tabulares) e `.reveal` / `.reveal.in` (revelação por scroll, usada na Tarefa 6).

- [ ] **Step 1: Instalar as fontes**

Três famílias, só os pesos usados. Sem CDN em runtime — o projeto é local-first.

```bash
npm install @fontsource/archivo @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
```

- [ ] **Step 2: Importar as fontes no topo de `src/main.tsx`**

Na linha 1, antes de `import './styles.css'`, acrescente os imports de peso. A ordem importa: as fontes precisam vir antes do CSS que as referencia.

```ts
import'@fontsource/archivo/700.css';import'@fontsource/archivo/800.css';import'@fontsource/ibm-plex-sans/400.css';import'@fontsource/ibm-plex-sans/500.css';import'@fontsource/ibm-plex-sans/600.css';import'@fontsource/ibm-plex-mono/400.css';import'@fontsource/ibm-plex-mono/600.css';import'./styles.css';
```

- [ ] **Step 3: Substituir o bloco `:root` de `src/styles.css`**

A linha 1 atual é:

```css
:root{--cyan:#00e5ff;--txt:#eafcff;--muted:#8fb5c6;--green:#36ff8b;--red:#ff4d6d;--panel:#071426dd}
```

Troque por (mantendo `--panel`, que é consumido por várias telas do sistema):

```css
:root{
 --bg:#05090F;--surface:#0B121C;--surface-2:#101A26;--line:#1B2A3A;--panel:#0B121Cdd;
 --cy-900:#04323A;--cy-500:#00C2D6;--cy-300:#4DE8F5;--cyan:#00e5ff;
 --txt:#E6F1F5;--muted:#7E97A8;--green:#2BD98A;--red:#FF5A5F;
 --font-display:'Archivo',system-ui,sans-serif;
 --font-body:'IBM Plex Sans',system-ui,sans-serif;
 --font-mono:'IBM Plex Mono',ui-monospace,monospace;
 --e-out:cubic-bezier(.22,1,.36,1);--e-in-out:cubic-bezier(.65,0,.35,1);
 --t-1:120ms;--t-2:180ms;--t-3:260ms;--t-4:420ms;
}
```

- [ ] **Step 4: Aplicar as famílias e o número tabular**

Logo depois do `:root`, adicione um bloco novo. `body` já tem regras na linha 2 de `styles.css` — **não substitua essa linha**, apenas acrescente estas regras depois dela, para que a cascata resolva a favor das novas.

```css
/* v127 - tipografia: display para títulos, corpo para texto, mono tabular para todo número */
body{font-family:var(--font-body);-webkit-font-smoothing:antialiased}
h1,h2,h3,.lpH2,.brand,.authTitle{font-family:var(--font-display);letter-spacing:-.02em;font-weight:800}
.num,.card b,.metric b,.lpStrip b,.lpMockGrid b{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-weight:600;letter-spacing:-.01em}
```

- [ ] **Step 5: Adicionar os utilitários de movimento**

No fim de `src/styles.css`, em bloco próprio:

```css
/* v127 - camada de movimento. Tudo aqui respeita prefers-reduced-motion no fim do arquivo. */
.reveal{opacity:0;transform:translateY(8px);transition:opacity var(--t-4) var(--e-out),transform var(--t-4) var(--e-out)}
.reveal.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){
 *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
 .reveal{opacity:1;transform:none}
}
```

- [ ] **Step 6: Criar `.claude/launch.json`**

Só se o arquivo ainda não existir. Se existir com uma entrada equivalente, pule.

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["start"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 7: Verificar no navegador**

Suba com `preview_start` `{name: "dev"}` e abra a landing deslogado.

Confirme, nesta ordem:
1. `read_console_messages` `{onlyErrors: true}` retorna vazio.
2. `preview_logs` `{level: "error"}` não mostra erro de build do Vite.
3. Via `javascript_tool`: `getComputedStyle(document.querySelector('h1')).fontFamily` contém `Archivo`, e `getComputedStyle(document.body).fontFamily` contém `IBM Plex Sans`.
4. Faça login e visite Dashboard, Backtest Lab e Perfil. As telas devem estar legíveis com os tons novos — texto secundário agora é neutro, não azulado. Se algum texto ficou com contraste baixo demais sobre `--surface`, corrija o token, não a tela.
5. Screenshot da landing e de uma tela do sistema, para comparação depois.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/styles.css src/main.tsx .claude/launch.json
git commit -m "feat: tokens de cor, tipografia e movimento"
```

---

### Task 2: Marca — símbolo, wordmark e favicon

**Files:**
- Create: `src/brand.tsx`
- Modify: `src/main.tsx:109` (`.brand` do Sidebar), `src/main.tsx:175-176` (`.authLogo` e `.authTitle` do AuthCard), `src/main.tsx:1` (import)
- Modify: `index.html:9` (favicon)
- Modify: `src/styles.css` (bloco de marca)

**Interfaces:**
- Consumes: tokens da Tarefa 1.
- Produces:
  - `export function Mark({size=28,tone='color'}:{size?:number,tone?:'color'|'mono'}):JSX.Element` — só o símbolo, em SVG inline.
  - `export function Wordmark({size=21,withStudio=true}:{size?:number,withStudio?:boolean}):JSX.Element` — símbolo + texto, para nav, sidebar e card de autenticação.

O símbolo são três barras crescentes cortadas por uma linha horizontal de execução: gráfico mais nível de entrada. Sem rosto de robô, sem emoji.

- [ ] **Step 1: Criar `src/brand.tsx`**

```tsx
import React from'react';
// Marca: três barras crescentes cortadas pela linha de execução (o nível de entrada).
// viewBox 32x32 para continuar legível a 16px no favicon.
export function Mark({size=28,tone='color'}:{size?:number,tone?:'color'|'mono'}){
 const bar=tone==='mono'?'currentColor':'#00C2D6';
 const hit=tone==='mono'?'currentColor':'#00e5ff';
 return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="Forex IA Studio">
  <rect x="4" y="19" width="6" height="9" rx="1.5" fill={bar} opacity=".55"/>
  <rect x="13" y="13" width="6" height="15" rx="1.5" fill={bar} opacity=".8"/>
  <rect x="22" y="5" width="6" height="23" rx="1.5" fill={bar}/>
  <path d="M2 16h28" stroke={hit} strokeWidth="2" strokeLinecap="round"/>
 </svg>;
}
export function Wordmark({size=21,withStudio=true}:{size?:number,withStudio?:boolean}){
 return <span className="fiaMark" style={{fontSize:size}}><Mark size={Math.round(size*1.35)}/><b>FOREX <span>IA</span></b>{withStudio&&<em>STUDIO</em>}</span>;
}
```

- [ ] **Step 2: Estilizar a marca em `src/styles.css`**

```css
/* v127 - marca */
.fiaMark{display:inline-flex;align-items:center;gap:10px;font-family:var(--font-display);font-weight:800;white-space:nowrap;line-height:1}
.fiaMark b{font-weight:800;letter-spacing:-.02em}
.fiaMark b span{color:var(--cy-500)}
.fiaMark em{font-family:var(--font-body);font-style:normal;font-size:.5em;font-weight:600;letter-spacing:.18em;color:var(--muted);align-self:center;padding-left:2px}
.fiaMark svg{flex:0 0 auto}
```

Note que **não** há `text-shadow` aqui. O glow do ciano em texto sai por decisão da spec.

- [ ] **Step 3: Trocar a marca no Sidebar**

Em `src/main.tsx:109`, substitua:

```tsx
<div className="brand">🤖 FOREX <span>IA</span></div>
```

por:

```tsx
<div className="brand"><Wordmark size={22}/></div>
```

E acrescente ao import da linha 1: `import{Mark,Wordmark}from'./brand';`

- [ ] **Step 4: Trocar a marca no card de autenticação**

Em `src/main.tsx:175-176`, substitua as duas linhas:

```tsx
  <div className="authLogo"><div className="eyes"><i></i><i></i></div><b>W</b></div>
  <h1 className="authTitle">FOREX <span>IA</span></h1>
```

por:

```tsx
  <div className="authLogo"><Mark size={44}/></div>
  <h1 className="authTitle"><Wordmark size={26} withStudio={false}/></h1>
```

- [ ] **Step 5: Ajustar o estilo do `.authLogo`**

A regra atual em `src/styles.css:184` desenha o rosto de robô (`.authLogo .eyes`). Substitua a regra `.authLogo` e remova a de `.authLogo .eyes`, deixando uma placa neutra para o símbolo:

```css
.authLogo{display:flex;align-items:center;justify-content:center;width:72px;height:72px;margin:0 auto 14px;border-radius:20px;background:var(--surface-2);border:1px solid var(--line)}
```

Confira com grep que nenhuma outra regra depende de `.authLogo .eyes` antes de remover.

- [ ] **Step 6: Favicon**

Adicione em `index.html`, dentro do `<head>`, um SVG data-URI com a mesma geometria do símbolo:

```html
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='4' y='19' width='6' height='9' rx='1.5' fill='%2300C2D6' opacity='.55'/%3E%3Crect x='13' y='13' width='6' height='15' rx='1.5' fill='%2300C2D6' opacity='.8'/%3E%3Crect x='22' y='5' width='6' height='23' rx='1.5' fill='%2300C2D6'/%3E%3Cpath d='M2 16h28' stroke='%2300e5ff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E">
```

- [ ] **Step 7: Verificar**

1. `read_console_messages` `{onlyErrors: true}` vazio.
2. Landing deslogada: a marca aparece na nav sem emoji.
3. Abra o modal de login: o símbolo aparece na placa, sem os olhos de robô.
4. Faça login: a marca do sidebar é a mesma da landing.
5. Zoom na marca a tamanho pequeno via `computer` `{action: "zoom"}` — as três barras e a linha continuam distinguíveis.
6. Screenshot da nav e do modal.

- [ ] **Step 8: Commit**

```bash
git add src/brand.tsx src/main.tsx src/styles.css index.html
git commit -m "feat: marca com simbolo, wordmark e favicon"
```

---

### Task 3: Extrair a Landing para `src/landing.tsx`

Refatoração pura, sem mudança visual. Feita separada para que qualquer regressão apareça isolada, antes do redesenho.

**Files:**
- Create: `src/landing.tsx`
- Modify: `src/main.tsx:954-1084` (remover `LP_STEPS`, `LP_FEATURES`, `LP_FAQ` e `function Landing`), `src/main.tsx:1` (import), `src/main.tsx:150` (exportar `AuthCard`), `src/main.tsx:61` (exportar `billingErrorInfo` — usado na Tarefa 8)

**Interfaces:**
- Consumes: `Mark`, `Wordmark` de `./brand`.
- Produces: `export default function Landing({setSession}:any):JSX.Element` em `src/landing.tsx`.
- `src/main.tsx` passa a exportar: `export function AuthCard(...)`, `export const api`, `export const money`, `export const br`, `export function billingErrorInfo(...)`.

**Atenção ao ciclo de import:** `main.tsx` importa `Landing` e `landing.tsx` importa `AuthCard` de `main.tsx`. É um ciclo, mas funciona com ESM porque `Landing` só é chamado em tempo de render, nunca no topo do módulo. Não mova `AuthCard` para um terceiro arquivo — está fora do escopo.

- [ ] **Step 1: Marcar as exportações em `src/main.tsx`**

Acrescente `export` antes de: `const api=` (linha 49), `const br=` e `const money=` (linha 60), `function billingErrorInfo` (linha 61), `function AuthCard` (linha 150). Nada mais muda nessas linhas.

- [ ] **Step 2: Criar `src/landing.tsx` movendo o código atual sem alterar**

Copie **exatamente** o conteúdo de `src/main.tsx:955-1084` (os três arrays `LP_*` e `function Landing`) para o arquivo novo, com este cabeçalho:

```tsx
import React,{useEffect,useState}from'react';
import{AuthCard}from'./main';
import{Mark,Wordmark}from'./brand';
```

e troque a assinatura `function Landing({setSession}:any){` por `export default function Landing({setSession}:any){`.

Nesta etapa **não mude uma vírgula do JSX**. O objetivo é que a página fique pixel a pixel igual.

- [ ] **Step 3: Remover o código antigo de `src/main.tsx`**

Apague as linhas 954-1084 (o comentário `// v126 — Landing Page pública...`, os três arrays e a função). Acrescente ao import da linha 1:

```ts
import Landing from'./landing';
```

- [ ] **Step 4: Verificar que nada mudou visualmente**

1. `preview_logs` `{level: "error"}` sem erro de build.
2. `read_console_messages` `{onlyErrors: true}` vazio.
3. Screenshot da landing e compare com o da Tarefa 2. Deve estar idêntica exceto pela marca já trocada.
4. Clique em "Entrar" e em "Criar conta grátis": o modal abre. Pressione Escape: fecha. Clique fora: fecha.
5. Clique em "Ver como funciona": rola suave até a seção.

- [ ] **Step 5: Commit**

```bash
git add src/landing.tsx src/main.tsx
git commit -m "refactor: extrai a Landing para src/landing.tsx"
```

---

### Task 4: Nav, hero e painel de reconciliação

Primeira tarefa de redesenho. Entrega o topo inteiro da página com a copy nova e o elemento-assinatura.

**Files:**
- Modify: `src/landing.tsx` (nav e hero)
- Modify: `src/styles.css` (bloco `/* v127 - landing */`)

**Interfaces:**
- Consumes: tokens da Tarefa 1, `Mark`/`Wordmark` da Tarefa 2.
- Produces: o array `LP_RECON` e o componente `ReconPanel`, consumidos pela Tarefa 6 (que anima os contadores).

- [ ] **Step 1: Substituir a nav**

Troque o bloco `<header className="lpNav">` inteiro por:

```tsx
  <header className="lpNav">
   <div className="lpNavIn">
    <Wordmark size={20}/>
    <nav className="lpLinks">
     <a href="#como" onClick={ir('como')}>Como funciona</a>
     <a href="#recursos" onClick={ir('recursos')}>Recursos</a>
     <a href="#precos" onClick={ir('precos')}>Preços</a>
     <a href="#objecoes" onClick={ir('objecoes')}>Dúvidas</a>
    </nav>
    <div className="lpNavBtns">
     <button className="lpGhost" onClick={()=>setAuth('login')}>Entrar</button>
     <button className="lpCta" onClick={()=>setAuth('signup')}>Criar conta grátis</button>
    </div>
   </div>
  </header>
```

- [ ] **Step 2: Definir os dados do painel de reconciliação**

Acima de `function Landing`, junto dos outros arrays de conteúdo:

```tsx
// Painel-assinatura do hero: as mesmas métricas medidas nos dois lados.
// Números ilustrativos — a página deixa isso explícito no rótulo.
const LP_RECON:any[]=[
 ['Operações','842','842',0],
 ['Taxa de acerto','61,2%','61,2%',1],
 ['Profit factor','1,74','1,74',2],
 ['Drawdown','8,3%','8,3%',3],
];
```

- [ ] **Step 3: Criar o componente `ReconPanel`**

Ainda em `src/landing.tsx`, acima de `Landing`:

```tsx
function ReconPanel(){
 return <div className="lpRecon">
  <div className="lpReconHead"><b>Mesma estratégia, mesmo período</b><em>números ilustrativos</em></div>
  <div className="lpReconCols"><span>Forex IA Studio</span><span>MT5 Strategy Tester</span></div>
  {LP_RECON.map(([label,a,b]:any)=><div className="lpReconRow" key={label}>
   <i>{label}</i><b className="num">{a}</b><b className="num">{b}</b>
  </div>)}
  <div className="lpReconSeal"><ShieldCheck size={16}/> Conferido operação por operação</div>
 </div>;
}
```

Acrescente `ShieldCheck` ao import de `lucide-react` no topo de `src/landing.tsx`:

```ts
import{ShieldCheck}from'lucide-react';
```

- [ ] **Step 4: Substituir o hero**

Troque a `<section className="lpHero">` inteira (incluindo `.lpHeroArt`, `.lpFace` e `.lpMock`) por:

```tsx
  <section className="lpHero">
   <div className="lpHeroTxt">
    <span className="lpBadge">1º robô e 1º backtest grátis</span>
    <h1>O backtest só vale se bater com o do <span>MetaTrader 5</span>.</h1>
    <p>Importe os candles do seu próprio broker pela ponte EA, monte a estratégia sem código, otimize com algoritmo genético e exporte o Expert Advisor. Depois coloque os números lado a lado com o Strategy Tester.</p>
    <div className="lpHeroBtns">
     <button className="lpCta lpBig" onClick={()=>setAuth('signup')}>Criar conta grátis</button>
     <button className="lpGhost lpBig" onClick={ir('como')}>Ver como funciona</button>
    </div>
    <p className="lpMicro">Sem mensalidade · você paga por uso · recarga por PIX</p>
   </div>
   <div className="lpHeroArt"><ReconPanel/></div>
  </section>
```

- [ ] **Step 5: Reescrever a faixa de fatos**

A faixa atual afirma "15 ferramentas em um só lugar". Troque a `<section className="lpStrip">` por afirmações verificáveis, com os números em mono:

```tsx
  <section className="lpStrip">
   <div><b className="num">.mq5</b><span>Expert Advisor exportado, compilável no seu MT5</span></div>
   <div><b className="num">R$ 0,26</b><span>por indicador para criar — sem mensalidade</span></div>
   <div><b className="num">0</b><span>linhas de MQL5 escritas por você</span></div>
   <div><b className="num">100%</b><span>da execução dentro do seu MetaTrader 5</span></div>
  </section>
```

- [ ] **Step 6: Estilos do topo**

Substitua, no bloco `/* v126 */` de `src/styles.css`, as regras de `.lpNav`, `.lpBrand`, `.lpCta`, `.lpGhost`, `.lpHero`, `.lpBadge`, `.lpHeroTxt`, `.lpStrip`; e remova `.lpBrand`, `.lpFace`, `@keyframes lpFloat`, `.lpMock*` e `.lpSpark`, que deixaram de existir no JSX. **Confira com grep** que nenhuma outra tela usa essas classes antes de remover.

```css
/* v127 - landing: topo */
.lpNav{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.lpNavIn{max-width:1160px;margin:0 auto;padding:14px 22px;display:flex;align-items:center;gap:22px}
.lpLinks{display:flex;gap:26px;margin-left:auto}
.lpLinks a{color:var(--muted);text-decoration:none;font-weight:500;font-size:14.5px;transition:color var(--t-2) var(--e-out)}
.lpLinks a:hover{color:var(--txt)}
.lpNavBtns{display:flex;gap:10px;margin-left:auto}
.lpLinks+.lpNavBtns{margin-left:0}
.lp button{margin:0}
.lpCta{background:var(--cy-500);color:#02171B;border:0;border-radius:12px;padding:11px 20px;font-weight:600;font-size:14.5px;cursor:pointer;transition:transform var(--t-1) var(--e-out),background var(--t-2) var(--e-out),box-shadow var(--t-2) var(--e-out)}
.lpCta:hover{background:var(--cyan);box-shadow:0 0 28px color-mix(in srgb,var(--cyan) 28%,transparent)}
.lpCta:active{transform:translateY(1px)}
.lpGhost{background:transparent;color:var(--txt);border:1px solid var(--line);border-radius:12px;padding:11px 20px;font-weight:600;font-size:14.5px;cursor:pointer;transition:border-color var(--t-2) var(--e-out),background var(--t-2) var(--e-out),transform var(--t-1) var(--e-out)}
.lpGhost:hover{border-color:var(--cy-500);background:color-mix(in srgb,var(--cy-500) 8%,transparent)}
.lpGhost:active{transform:translateY(1px)}
.lpBig{padding:16px 28px;font-size:16px;border-radius:14px}
.lpHero{max-width:1160px;margin:0 auto;padding:78px 22px 64px;display:grid;grid-template-columns:1.05fr .95fr;gap:52px;align-items:center}
.lpBadge{display:inline-block;background:color-mix(in srgb,var(--green) 10%,transparent);border:1px solid color-mix(in srgb,var(--green) 34%,transparent);color:var(--green);border-radius:999px;padding:7px 15px;font-size:13px;font-weight:600;margin-bottom:22px}
.lpHeroTxt h1{font-size:clamp(34px,4.6vw,56px);line-height:1.04;margin:0 0 20px}
.lpHeroTxt h1 span{color:var(--cy-500)}
.lpHeroTxt>p{color:var(--muted);font-size:17.5px;line-height:1.62;margin:0 0 30px;max-width:560px}
.lpHeroBtns{display:flex;gap:14px;flex-wrap:wrap}
.lpMicro{color:var(--muted);font-size:13.5px;margin:18px 0 0}
.lpHeroArt{display:flex;justify-content:center}
/* painel de reconciliação: o elemento-assinatura */
.lpRecon{width:100%;max-width:440px;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:20px}
.lpReconHead{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:16px}
.lpReconHead b{font-size:14.5px;font-weight:600}
.lpReconHead em{color:var(--muted);font-style:normal;font-size:11.5px}
.lpReconCols,.lpReconRow{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;align-items:center}
.lpReconCols{padding:0 0 10px;border-bottom:1px solid var(--line)}
.lpReconCols span{color:var(--muted);font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:right}
.lpReconCols span:first-child{visibility:hidden}
.lpReconRow{padding:11px 0;border-bottom:1px solid var(--line)}
.lpReconRow i{color:var(--muted);font-style:normal;font-size:13.5px}
.lpReconRow b{font-size:16px;text-align:right;color:var(--txt)}
.lpReconSeal{display:flex;align-items:center;gap:8px;margin-top:14px;color:var(--green);font-size:13px;font-weight:600}
.lpStrip{max-width:1160px;margin:0 auto;padding:0 22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.lpStrip div{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px}
.lpStrip b{display:block;color:var(--cy-500);font-size:26px}
.lpStrip span{display:block;color:var(--muted);font-size:13.5px;margin-top:6px;line-height:1.45}
@media(max-width:900px){.lpHero{grid-template-columns:1fr;padding-top:52px}.lpLinks{display:none}}
```

- [ ] **Step 7: Verificar**

1. `read_console_messages` `{onlyErrors: true}` vazio.
2. `read_page` confirma a H1 nova e as duas colunas do painel.
3. `resize_window` preset `mobile`, recarregue: sem scroll horizontal, os links da nav somem, os CTAs continuam com no mínimo 44px de altura. Confira via `javascript_tool`: `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
4. Screenshot em desktop e mobile.

- [ ] **Step 8: Commit**

```bash
git add src/landing.tsx src/styles.css
git commit -m "feat: novo hero com painel de reconciliacao e copy reescrita"
```

---

### Task 5: Seções — passos, recursos, objeções, preços e fechamento

**Files:**
- Modify: `src/landing.tsx` (arrays `LP_STEPS`, `LP_FEATURES`, `LP_FAQ` e as seções correspondentes)
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: tokens da Tarefa 1.
- Produces: os arrays `LP_STEPS`, `LP_FEATURES` (agora com componente de ícone, não emoji) e `LP_OBJ`; a classe `.lpIco` com variantes `.d`/`.c`/`.a`/`.p`, consumida pela Tarefa 6.

- [ ] **Step 1: Trocar os emojis por ícones lucide com categoria**

Substitua `LP_FEATURES` por (cada item ganha um componente e uma categoria de tinta: `d` dados, `c` criação, `a` análise, `p` produção):

```tsx
const LP_FEATURES:any[]=[
 [DownloadCloud,'d','Smart Import','Os candles vêm do seu próprio broker pela ponte EA, com deduplicação automática e progresso por par e timeframe. Você não baixa CSV de lugar nenhum.'],
 [Brain,'c','Criar robô sem código','Médias, RSI, MACD, Bollinger, estocástico e mais, combinados em regras de entrada e saída explícitas. O MQL5 é gerado no fim.'],
 [Mic,'c','Agente de voz','Descreva a estratégia falando em português. O agente monta a configuração e devolve para você revisar antes de salvar.'],
 [FlaskConical,'a','Backtest Lab','Curva de capital, drawdown, profit factor, taxa de acerto e a lista completa de operações do período — não só o número final.'],
 [Dna,'a','Otimizador genético','Gerações de parâmetros avaliadas contra o histórico até convergir. Você define população, gerações, mínimo de trades e teto de drawdown.'],
 [ShieldCheck,'p','Validação MT5','Compare o backtest da plataforma com o do Strategy Tester, operação por operação, e veja onde os dois divergem.'],
 [RadioTower,'p','Teste real','Telemetria de conta, posições e ordens do robô em demo ou real. O EA executa; a plataforma só observa.'],
 [Trophy,'a','Ranking e comparação','Coloque robôs lado a lado no mesmo dataset e no mesmo período para ver qual sustenta o resultado.'],
];
```

Import correspondente no topo de `src/landing.tsx`:

```ts
import{ShieldCheck,DownloadCloud,Brain,Mic,FlaskConical,Dna,RadioTower,Trophy,ArrowRight}from'lucide-react';
```

- [ ] **Step 2: Renderizar os cards com placa flat**

Troque a seção `#recursos`:

```tsx
  <section id="recursos" className="lpSec">
   <h2 className="lpH2 reveal">Cada etapa deixa um número que você pode conferir</h2>
   <p className="lpSub reveal">Da importação dos candles ao robô rodando em conta real.</p>
   <div className="lpFeat">{LP_FEATURES.map(([Ico,cat,t,d]:any)=><div className={'lpCard reveal'} key={t}><span className={'lpIco '+cat}><Ico size={22} strokeWidth={2.2}/></span><h3>{t}</h3><p>{d}</p></div>)}</div>
  </section>
```

- [ ] **Step 3: Reescrever os passos**

`LP_STEPS` mantém a numeração — a ordem é real e informativa — mas a copy fica concreta:

```tsx
const LP_STEPS:any[]=[
 ['01','Conecte o MetaTrader 5','Instale a ponte EA e ela envia os candles do seu broker para a plataforma. A base histórica é montada por par e timeframe, com os dados que você realmente vai operar.'],
 ['02','Monte a estratégia','Escolha indicadores e escreva as regras de entrada e saída na tela — ou dite a estratégia para o agente de voz e revise o que ele montou.'],
 ['03','Backteste e otimize','Rode sobre o histórico importado e deixe o otimizador genético varrer gerações de parâmetros até achar o conjunto que sustenta o resultado.'],
 ['04','Exporte e confira no MT5','Baixe o Expert Advisor em .mq5, compile no MetaTrader 5 e compare o backtest da plataforma com o do Strategy Tester antes de colocar em conta real.'],
];
```

E o título da seção `#como`: `<h2 className="lpH2 reveal">Do primeiro candle ao robô compilado, em quatro etapas</h2>` com subtítulo `<p className="lpSub reveal">Nenhuma delas exige programação. Você decide a lógica; a plataforma gera o código.</p>`. Acrescente `reveal` à className de cada `.lpStep`.

- [ ] **Step 4: Reposicionar a FAQ como quebra de objeção**

Renomeie `LP_FAQ` para `LP_OBJ`, troque o `id="faq"` por `id="objecoes"` e reescreva o conteúdo, liderando pela objeção mais forte:

```tsx
const LP_OBJ:any[]=[
 ['O robô vai operar sozinho com o meu dinheiro?','A execução das ordens é sempre do Expert Advisor rodando dentro do seu MetaTrader 5. A plataforma cria, testa, otimiza e monitora — ela nunca fica no caminho crítico da ordem. Se a plataforma cair, o robô continua fazendo exatamente o que o código dele manda.'],
 ['E se o backtest da plataforma não bater com o do MT5?','Aí você não deveria confiar nele — e é por isso que a tela de Validação MT5 existe. Ela coloca os dois lado a lado, operação por operação, começando por horário e direção. Divergência aparece, não fica escondida.'],
 ['Preciso saber programar?','Não. A estratégia é montada por indicadores e regras na tela, ou ditada por voz. O código MQL5 do Expert Advisor é gerado pela plataforma no fim do processo.'],
 ['Funciona com a minha corretora?','Funciona com qualquer corretora que ofereça MetaTrader 5. A plataforma conversa com o seu terminal por uma ponte (um Expert Advisor) que você mesmo instala.'],
 ['Quanto vou gastar de verdade?','Você paga por ação e por indicador da estratégia. Uma estratégia de 3 indicadores custa R$ 0,78 para criar, R$ 0,30 por backtest e R$ 1,50 por otimização. Sem mensalidade, sem fidelidade, recarga por PIX quando quiser.'],
 ['Meus dados ficam onde?','A base de candles e os robôs ficam no seu ambiente. Conta e carteira são autenticadas por token, e as chaves sensíveis do servidor nunca chegam ao navegador.'],
];
```

Título da seção: `<h2 className="lpH2 reveal">O que costuma travar a decisão</h2>`.

- [ ] **Step 5: Preços com exemplo concreto**

Substitua o segundo card de `.lpPrice` (o `Pay-per-use`) para mostrar a conta fechada, e troque os emojis dos `<li>` por ícones:

```tsx
    <div className="lpPriceCard">
     <h3>Pago por uso</h3><b className="num">R$ 0,26<em>/indicador</em></b>
     <p>Depois do teste grátis, cada ação tem custo por indicador da estratégia:</p>
     <ul className="lpPriceList">
      <li><span>Criar robô</span><b className="num">R$ 0,26</b></li>
      <li><span>Backtest</span><b className="num">R$ 0,10</b></li>
      <li><span>Otimizador genético</span><b className="num">R$ 0,50</b></li>
     </ul>
     <p className="lpExample">Na prática: uma estratégia com <b>3 indicadores</b> sai por <b className="num">R$ 0,78</b> para criar, <b className="num">R$ 0,30</b> por backtest e <b className="num">R$ 1,50</b> por otimização.</p>
     <p className="lpMicro">Recarga por PIX. O saldo fica na carteira e não vence.</p>
    </div>
```

No card grátis, troque os `✔` por `<ArrowRight size={14}/>` dentro de um `<span className="lpTick">`.

- [ ] **Step 6: Estilos das seções**

```css
/* v127 - landing: seções */
.lpSec{max-width:1160px;margin:0 auto;padding:88px 22px 0}
.lpH2{font-size:clamp(26px,3.2vw,37px);text-align:center;line-height:1.14}
.lpSub{text-align:center;color:var(--muted);font-size:16.5px;max-width:640px;margin:14px auto 46px;line-height:1.55}
.lpSteps{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.lpStep{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:26px}
.lpStep>b{display:block;font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--cy-500);margin-bottom:14px;letter-spacing:.08em}
.lpStep h3{font-size:19px;margin-bottom:10px}
.lpStep p{color:var(--muted);font-size:14.5px;line-height:1.62;margin:0}
.lpFeat{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:16px}
.lpCard{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:24px;transition:border-color var(--t-2) var(--e-out),transform var(--t-2) var(--e-out)}
.lpCard:hover{border-color:var(--cy-500);transform:translateY(-2px)}
/* placa flat: o ícone mora dentro de um bloco sólido tintado por categoria */
.lpIco{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;margin-bottom:15px;transition:transform var(--t-2) var(--e-out)}
.lpIco.d{background:color-mix(in srgb,var(--cy-500) 18%,var(--surface-2));color:var(--cy-300)}
.lpIco.c{background:color-mix(in srgb,#7C6BFF 20%,var(--surface-2));color:#B7ADFF}
.lpIco.a{background:color-mix(in srgb,var(--green) 16%,var(--surface-2));color:var(--green)}
.lpIco.p{background:color-mix(in srgb,#FFB020 16%,var(--surface-2));color:#FFC85C}
.lpCard:hover .lpIco{transform:scale(1.06)}
.lpCard h3{font-size:17.5px;margin-bottom:9px}
.lpCard p{color:var(--muted);font-size:14.5px;line-height:1.62;margin:0}
.lpPriceList{list-style:none;padding:0;margin:16px 0}
.lpPriceList li{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);font-size:14.5px}
.lpPriceList li span{color:var(--muted)}
.lpExample{background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:14px;font-size:14px;line-height:1.6;color:var(--txt)}
.lpTick{display:inline-flex;align-items:center;color:var(--green);margin-right:8px;vertical-align:-2px}
```

- [ ] **Step 7: Verificar**

1. `read_console_messages` `{onlyErrors: true}` vazio.
2. `read_page`: nenhum caractere de emoji sobrou na landing. Confirme via `javascript_tool`:
   `/\p{Extended_Pictographic}/u.test(document.querySelector('.lp').innerText)` deve retornar `false`.
3. As quatro tintas de placa aparecem e agrupam os recursos por etapa do fluxo.
4. Confira os valores da seção de preços contra `billing/routes.cjs:6`.
5. Screenshot de cada seção.

- [ ] **Step 8: Commit**

```bash
git add src/landing.tsx src/styles.css
git commit -m "feat: secoes da landing com icones em placa e copy reescrita"
```

---

### Task 6: Movimento da landing

**Files:**
- Modify: `src/landing.tsx` (hook de revelação, contadores, entrada em stagger, acordeão)
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `.reveal` / `.reveal.in` da Tarefa 1; `ReconPanel` da Tarefa 4; `LP_OBJ` da Tarefa 5.
- Produces: `useReveal()` e `useCountUp(alvo:string, ativo:boolean)`, internos a `src/landing.tsx`.

- [ ] **Step 1: Hook de revelação por scroll**

Em `src/landing.tsx`, acima de `Landing`:

```tsx
// Revela os elementos .reveal uma única vez quando entram na viewport.
// Um observer só para a página toda; nada de listener de scroll.
function useReveal(){
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));return}
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -12% 0px',threshold:.15});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
  return()=>io.disconnect();
 },[]);
}
```

Chame `useReveal()` na primeira linha de `Landing`.

- [ ] **Step 2: Stagger de entrada do hero**

Adicione ao CSS. O atraso é por posição, com uma variável por elemento:

```css
/* v127 - entrada da página: escada curta, só no topo */
@keyframes lpIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.lpHeroTxt>*,.lpHeroArt{animation:lpIn var(--t-4) var(--e-out) both;animation-delay:calc(var(--i,0)*70ms)}
@media(prefers-reduced-motion:reduce){.lpHeroTxt>*,.lpHeroArt{animation:none}}
```

E no JSX do hero, numere os filhos com `style={{'--i':n} as any}`: badge `0`, h1 `1`, parágrafo `2`, `.lpHeroBtns` `3`, `.lpMicro` `4`, `.lpHeroArt` `3`.

- [ ] **Step 3: Contador animado no painel de reconciliação**

Os valores de `LP_RECON` são strings formatadas em pt-BR (`'61,2%'`). O contador anima só a parte numérica e preserva sufixo e vírgula decimal.

```tsx
// Conta até o valor final preservando a formatação pt-BR do texto original.
function useCountUp(alvo:string,ativo:boolean){
 const[txt,setTxt]=useState(alvo);
 useEffect(()=>{
  if(!ativo)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setTxt(alvo);return}
  const m=String(alvo).match(/^([\d.,]+)(.*)$/); if(!m){setTxt(alvo);return}
  const casas=(m[1].split(',')[1]||'').length, fim=parseFloat(m[1].replace(/\./g,'').replace(',','.')), sufixo=m[2], ini=performance.now(), dur=900;
  let raf=0;
  const passo=(t:number)=>{
   const p=Math.min(1,(t-ini)/dur), eased=1-Math.pow(1-p,3);
   setTxt((fim*eased).toLocaleString('pt-BR',{minimumFractionDigits:casas,maximumFractionDigits:casas})+sufixo);
   if(p<1)raf=requestAnimationFrame(passo);
  };
  raf=requestAnimationFrame(passo);
  return()=>cancelAnimationFrame(raf);
 },[alvo,ativo]);
 return txt;
}
```

- [ ] **Step 4: Ligar o contador ao painel**

Reescreva `ReconPanel` para disparar quando entrar na viewport e revelar o selo só no fim:

```tsx
function ReconRow({label,a,b,i,ativo}:any){
 const va=useCountUp(a,ativo), vb=useCountUp(b,ativo);
 return <div className="lpReconRow" style={{'--i':i} as any}><i>{label}</i><b className="num">{va}</b><b className="num">{vb}</b></div>;
}
function ReconPanel(){
 const ref=useRef<any>(null), [ativo,setAtivo]=useState(false);
 useEffect(()=>{
  const el=ref.current; if(!el)return;
  const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){setAtivo(true);io.disconnect()}},{threshold:.4});
  io.observe(el); return()=>io.disconnect();
 },[]);
 return <div className="lpRecon" ref={ref}>
  <div className="lpReconHead"><b>Mesma estratégia, mesmo período</b><em>números ilustrativos</em></div>
  <div className="lpReconCols"><span>Forex IA Studio</span><span>MT5 Strategy Tester</span></div>
  {LP_RECON.map(([label,a,b,i]:any)=><ReconRow key={label} label={label} a={a} b={b} i={i} ativo={ativo}/>)}
  <div className={'lpReconSeal'+(ativo?' on':'')}><ShieldCheck size={16}/> Conferido operação por operação</div>
 </div>;
}
```

Acrescente `useRef` ao import de React no topo do arquivo.

CSS do selo:

```css
.lpReconSeal{display:flex;align-items:center;gap:8px;margin-top:14px;color:var(--green);font-size:13px;font-weight:600;opacity:0;transform:translateY(4px);transition:opacity var(--t-4) var(--e-out) 900ms,transform var(--t-4) var(--e-out) 900ms}
.lpReconSeal.on{opacity:1;transform:none}
```

- [ ] **Step 5: Acordeão de objeções com altura animada**

Substitua o `<details>` por um acordeão controlado, que permite animar a altura (o `<details>` nativo não permite):

```tsx
function Objecao({q,a}:any){
 const[open,setOpen]=useState(false), ref=useRef<any>(null);
 return <div className={'lpObj'+(open?' open':'')}>
  <button type="button" aria-expanded={open} onClick={()=>setOpen(o=>!o)}><span>{q}</span><i/></button>
  <div className="lpObjBody" style={{height:open?(ref.current?.scrollHeight||0)+'px':'0px'}}><p ref={ref}>{a}</p></div>
 </div>;
}
```

E a seção: `<div className="lpObjList">{LP_OBJ.map(([q,a]:any)=><Objecao key={q} q={q} a={a}/>)}</div>`

```css
.lpObjList{max-width:760px;margin:0 auto}
.lpObj{border-bottom:1px solid var(--line)}
.lpObj>button{width:100%;display:flex;align-items:center;gap:14px;background:none;border:0;color:var(--txt);text-align:left;font-family:var(--font-body);font-size:16.5px;font-weight:600;padding:20px 0;cursor:pointer;transition:color var(--t-2) var(--e-out)}
.lpObj>button:hover{color:var(--cy-500)}
.lpObj>button span{flex:1}
.lpObj>button i{flex:0 0 auto;width:12px;height:12px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg) translate(-3px,-3px);transition:transform var(--t-3) var(--e-out)}
.lpObj.open>button i{transform:rotate(-135deg) translate(-3px,-3px)}
.lpObjBody{overflow:hidden;transition:height var(--t-3) var(--e-in-out)}
.lpObjBody p{color:var(--muted);font-size:15px;line-height:1.68;margin:0 0 22px}
```

Remova as regras antigas de `.lpFaq details` / `summary` do CSS.

- [ ] **Step 6: Verificar**

1. `read_console_messages` `{onlyErrors: true}` vazio.
2. Recarregue: o hero entra em escada, sem salto de layout.
3. Role até o painel: os números contam e o selo aparece depois.
4. Role a página inteira: cada seção revela uma vez. Role para cima e para baixo de novo — nada re-anima.
5. Abra e feche três objeções: a altura anima nos dois sentidos e a seta gira.
6. Navegue só com Tab: todo controle recebe foco visível, inclusive os botões do acordeão.
7. Ative `prefers-reduced-motion` via `javascript_tool` ou DevTools e recarregue: nada anima e **todo** o conteúdo continua visível (esse é o erro clássico — `.reveal` preso em `opacity:0`).
8. Screenshot do painel com os números finais.

- [ ] **Step 7: Commit**

```bash
git add src/landing.tsx src/styles.css
git commit -m "feat: movimento da landing com revelacao, contadores e acordeao"
```

---

### Task 7: Camada de feedback (`src/feedback.tsx`)

**Files:**
- Create: `src/feedback.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: tokens da Tarefa 1.
- Produces (consumidos pela Tarefa 8):
  - `export function ToastProvider({children}:any):JSX.Element`
  - `export function useToast():{show:(t:{tipo:'ok'|'erro'|'info',texto:string,acao?:{rotulo:string,onClick:()=>void}})=>void}`
  - `export function LoadingButton({loading,children,...rest}:any):JSX.Element`
  - `export function Skeleton({linhas=3}:{linhas?:number}):JSX.Element`
  - `export function ProgressBar({valor,rotulo}:{valor:number,rotulo?:string}):JSX.Element` — `valor` de 0 a 1

- [ ] **Step 1: Criar `src/feedback.tsx`**

```tsx
import React,{createContext,useCallback,useContext,useState}from'react';
const Ctx=createContext<any>({show:()=>{}});
export function useToast(){return useContext(Ctx)}
export function ToastProvider({children}:any){
 const[itens,setItens]=useState<any[]>([]);
 const show=useCallback((t:any)=>{
  const id=Math.random().toString(36).slice(2);
  setItens(l=>[...l,{...t,id}]);
  // Erro fica mais tempo na tela: costuma exigir uma ação do usuário.
  setTimeout(()=>setItens(l=>l.filter(x=>x.id!==id)),t.tipo==='erro'?8000:4000);
 },[]);
 return <Ctx.Provider value={{show}}>{children}
  <div className="toastWrap" role="status" aria-live="polite">
   {itens.map(t=><div className={'toast '+t.tipo} key={t.id}>
    <span>{t.texto}</span>
    {t.acao&&<button onClick={()=>{t.acao.onClick();setItens(l=>l.filter(x=>x.id!==t.id))}}>{t.acao.rotulo}</button>}
   </div>)}
  </div>
 </Ctx.Provider>;
}
export function LoadingButton({loading,children,disabled,className,...rest}:any){
 return <button {...rest} disabled={disabled||loading} className={(className||'')+' btnLoad'+(loading?' on':'')}>
  {loading&&<i className="btnSpin" aria-hidden="true"/>}<span>{children}</span>
 </button>;
}
export function Skeleton({linhas=3}:{linhas?:number}){
 return <div className="skel" aria-hidden="true">{Array.from({length:linhas}).map((_,i)=><div key={i} style={{width:(100-i*11)+'%'}}/>)}</div>;
}
export function ProgressBar({valor,rotulo}:{valor:number,rotulo?:string}){
 const p=Math.max(0,Math.min(1,valor||0));
 return <div className="prog"><div className="progBar"><i style={{width:(p*100).toFixed(1)+'%'}}/></div>{rotulo&&<span className="num">{rotulo}</span>}</div>;
}
```

- [ ] **Step 2: Estilos**

```css
/* v127 - camada de feedback */
.toastWrap{position:fixed;right:18px;bottom:18px;z-index:60;display:flex;flex-direction:column;gap:10px;max-width:min(420px,calc(100vw - 36px));pointer-events:none}
.toast{pointer-events:auto;display:flex;align-items:center;gap:14px;background:var(--surface-2);border:1px solid var(--line);border-left-width:3px;border-radius:12px;padding:13px 16px;font-size:14.5px;line-height:1.45;color:var(--txt);box-shadow:0 12px 32px #0009;animation:toastIn var(--t-3) var(--e-out) both}
.toast.ok{border-left-color:var(--green)}
.toast.erro{border-left-color:var(--red)}
.toast.info{border-left-color:var(--cy-500)}
.toast button{margin:0;flex:0 0 auto;background:none;border:1px solid var(--line);color:var(--cy-500);border-radius:9px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;transition:border-color var(--t-2) var(--e-out)}
.toast button:hover{border-color:var(--cy-500)}
@keyframes toastIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.btnLoad{display:inline-flex;align-items:center;justify-content:center;gap:9px;transition:opacity var(--t-2) var(--e-out)}
.btnLoad.on{opacity:.78;cursor:progress}
.btnSpin{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin 700ms linear infinite;flex:0 0 auto}
@keyframes spin{to{transform:rotate(360deg)}}
.skel{display:flex;flex-direction:column;gap:10px}
.skel div{height:13px;border-radius:7px;background:linear-gradient(90deg,var(--surface-2) 25%,var(--line) 37%,var(--surface-2) 63%);background-size:400% 100%;animation:shimmer 1.4s var(--e-in-out) infinite}
@keyframes shimmer{from{background-position:100% 0}to{background-position:0 0}}
.prog{display:flex;align-items:center;gap:12px}
.progBar{flex:1;height:7px;border-radius:99px;background:var(--surface-2);overflow:hidden}
.progBar i{display:block;height:100%;background:var(--cy-500);border-radius:99px;transition:width var(--t-4) var(--e-out)}
.prog span{color:var(--muted);font-size:13px}
@media(prefers-reduced-motion:reduce){.btnSpin,.skel div{animation:none}.toast{animation:none}}
```

Note o `prefers-reduced-motion` no fim: o spinner e o shimmer param, mas os elementos continuam visíveis.

- [ ] **Step 3: Verificar isoladamente antes de integrar**

Monte um teste temporário: no `App` de `src/main.tsx`, dentro do JSX logado, insira provisoriamente `<ToastProvider>` em volta de `<main>` e um botão que chama `show({tipo:'ok',texto:'Teste'})`.

Confirme: o toast entra animado, some sozinho, o de erro dura mais, e o botão de ação funciona e fecha o toast. Depois **remova o botão de teste** — o provider fica, porque a Tarefa 8 depende dele.

- [ ] **Step 4: Commit**

```bash
git add src/feedback.tsx src/styles.css src/main.tsx
git commit -m "feat: camada de feedback com toast, botao de carregamento, skeleton e progresso"
```

---

### Task 8: Aplicar o feedback nas telas do sistema

**Files:**
- Modify: `src/main.tsx` — `App` (provider), `RobotBuilder` (`src/main.tsx:585` `save()`), `BacktestLab` (botão de rodar), `OptimizerPage` (`src/main.tsx:943`)

**Interfaces:**
- Consumes: `ToastProvider`, `useToast`, `LoadingButton`, `ProgressBar` da Tarefa 7; `billingErrorInfo` de `src/main.tsx:61`.
- Produces: nada consumido adiante.

Regra desta tarefa: **os estados existentes (`loading`, `running`, `err`) não são substituídos.** O feedback novo é adicionado por cima, para não arriscar o fluxo de cobrança.

- [ ] **Step 1: Envolver a aplicação no provider**

No `return` de `App` (`src/main.tsx:1132`), envolva o conteúdo logado:

```tsx
return <ToastProvider><div className="app">…</div></ToastProvider>
```

E acrescente ao import: `import{ToastProvider,useToast,LoadingButton,ProgressBar}from'./feedback';`

- [ ] **Step 2: Toast de erro de cobrança no otimizador**

`OptimizerPage` já monta `err` e `errPerfil` a partir de `billingErrorInfo`. Adicione o toast no `catch` de `run()`, mantendo o `<p className="warn">` existente:

```tsx
 const toast=useToast();
 // …dentro do catch de run(), depois de setErr:
 const info=billingErrorInfo(e);
 toast.show({tipo:'erro',texto:info.message,...(info.needsPerfil?{acao:{rotulo:'Ir para o Perfil',onClick:()=>setPage&&setPage('perfil')}}:{})});
```

- [ ] **Step 3: Botão do otimizador com carregamento**

Substitua a linha 943 de `src/main.tsx`:

```tsx
   <button disabled={running||!robotId||!datasetId} onClick={run}>{running?'Otimizando...':'Executar otimização genética'}</button>
```

por:

```tsx
   <LoadingButton loading={running} disabled={!robotId||!datasetId} onClick={run}>{running?'Otimizando':'Executar otimização genética'}</LoadingButton>
```

- [ ] **Step 4: Progresso do otimizador**

O backend responde a otimização inteira de uma vez, então não há progresso real por geração. Em vez de inventar uma barra falsa, mostre o progresso **previsto** a partir do ETA que a tela já calcula (`etaSec`, usado em `src/main.tsx:940`), rotulado como estimativa:

```tsx
 const[decorrido,setDecorrido]=useState(0);
 useEffect(()=>{if(!running){setDecorrido(0);return}const t0=Date.now();const t=setInterval(()=>setDecorrido((Date.now()-t0)/1000),250);return()=>clearInterval(t)},[running]);
 // …no JSX, logo abaixo do botão:
 {running&&<ProgressBar valor={etaSec?Math.min(.97,decorrido/etaSec):0} rotulo={`estimativa · ${fmt(Math.max(0,etaSec-decorrido))} restantes`}/>}
```

O teto de `.97` é deliberado: a barra nunca finge ter terminado antes de a resposta chegar.

- [ ] **Step 5: Mesmo tratamento no Backtest Lab e no RobotBuilder**

Em `BacktestLab`, troque o botão de rodar backtest por `LoadingButton` com o estado de carregamento que a tela já tem, e adicione toast de sucesso (`{tipo:'ok',texto:'Backtest concluído.'}`) e de erro via `billingErrorInfo`, com a ação para o Perfil quando `needsPerfil`.

Em `RobotBuilder`, faça o mesmo no `save()` (`src/main.tsx:585`): toast `{tipo:'ok',texto:'Robô salvo.'}` no sucesso. O `LoadingOverlay` existente (`src/main.tsx:425`) permanece — ele cobre a espera longa, o toast confirma o desfecho.

- [ ] **Step 6: Verificar com ações reais**

Não simule: exercite de verdade, com o servidor rodando e logado.

1. Salve um robô: `LoadingOverlay` aparece e, ao terminar, o toast de sucesso entra.
2. Rode um backtest: o botão mostra o spinner e fica desabilitado; nenhum clique duplo dispara duas cobranças.
3. Rode o otimizador: a barra de estimativa avança e para em 97% até a resposta chegar.
4. Provoque saldo insuficiente (conta sem crédito, com o robô grátis já usado): o toast de erro aparece com o botão "Ir para o Perfil", e o clique navega.
5. `read_console_messages` `{onlyErrors: true}` vazio depois de tudo.

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx
git commit -m "feat: aplica feedback animado no builder, no lab e no otimizador"
```

---

### Task 9: Passada final — responsivo, acessibilidade e limpeza

**Files:**
- Modify: `src/styles.css` (ajustes finais e remoção de regras órfãs)
- Modify: `src/landing.tsx` (ajustes finais)

**Interfaces:**
- Consumes: tudo das tarefas anteriores.
- Produces: nada.

- [ ] **Step 1: Remover CSS órfão**

Faça grep de cada classe removida ao longo do trabalho — `.lpFace`, `.lpMock`, `.lpMockHead`, `.lpMockGrid`, `.lpSpark`, `.lpBrand`, `.lpFaq`, `.lpIco` antigo, `.authLogo .eyes`, `@keyframes lpFloat` — e apague as regras que não têm mais consumidor. **Confirme cada uma com grep em `src/` antes de apagar**: `.eyes` também é usada pelo `.robotFace` do dashboard, que continua existindo.

- [ ] **Step 2: Rodapé e CTA final**

Confirme que o aviso de risco (`.lpRisk`) continua com o texto integral — é conteúdo regulatório e não pode ser encurtado. Atualize o CTA final para a voz nova:

```tsx
  <section className="lpFinal">
   <h2>Sua próxima estratégia pode estar testada hoje.</h2>
   <p>Crie a conta, importe seus candles e rode o primeiro backtest sem pagar nada.</p>
   <div className="lpHeroBtns"><button className="lpCta lpBig" onClick={()=>setAuth('signup')}>Criar conta grátis</button><button className="lpGhost lpBig" onClick={()=>setAuth('login')}>Já tenho conta</button></div>
  </section>
```

- [ ] **Step 3: Checagem responsiva completa**

Para cada preset — `mobile` (375), `tablet` (768), `desktop` (1280) — recarregue e confirme:

- `document.documentElement.scrollWidth <= document.documentElement.clientWidth` retorna `true`.
- Nenhum texto vaza do card nem fica truncado.
- Todo botão tem no mínimo 44px de altura: rode via `javascript_tool`
  `[...document.querySelectorAll('.lp button')].filter(b=>b.getBoundingClientRect().height<44).length` — deve ser `0`.
- O painel de reconciliação continua legível empilhado em 375px.

- [ ] **Step 4: Acessibilidade**

- Navegue a landing inteira só com Tab. Todo controle recebe foco visível, na ordem visual.
- O acordeão abre e fecha com Enter e Espaço, e `aria-expanded` acompanha o estado.
- Contraste: texto `--muted` sobre `--surface` precisa passar de 4.5:1. Meça e, se não passar, clareie `--muted` (não escureça o fundo — outras telas dependem dele).
- Com `prefers-reduced-motion: reduce`, recarregue e percorra a página inteira: nada anima e nada fica invisível.

- [ ] **Step 5: Regressão do sistema**

Logado, visite Dashboard, Smart Import, Datasets, Backtest Lab, Otimizador, Validação MT5 e Perfil. Os tokens novos mudaram o tom de todas elas. Procure por: texto com contraste baixo, borda que sumiu, número que perdeu o alinhamento. Corrija no token ou na regra específica da tela — não desfaça os tokens.

- [ ] **Step 6: Provas visuais**

Screenshots de: landing completa em desktop, landing em mobile, painel de reconciliação, seção de recursos, toast de erro com CTA, otimizador com a barra de progresso.

- [ ] **Step 7: Commit**

```bash
git add src/styles.css src/landing.tsx
git commit -m "polish: responsivo, acessibilidade e limpeza de CSS orfao"
```

---

## Auto-revisão do plano

**Cobertura da spec:**

| Requisito da spec | Tarefa |
|---|---|
| Tokens de cor (ciano como sinal) | 1 |
| Tipografia em três papéis, mono tabular | 1 |
| Copy reescrita sobre a tese da reconciliação | 4, 5 |
| Elemento-assinatura (painel de reconciliação) | 4, 6 |
| Ícones lucide em placa flat, sem emoji | 5 |
| Marca, wordmark e favicon | 2 |
| Sistema de movimento (tokens, revelação, contadores, acordeão) | 1, 6 |
| Camada de feedback (toast, botão, skeleton, progresso) | 7, 8 |
| Estrutura de página em 9 blocos | 4, 5, 9 |
| Extração em `brand.tsx` / `landing.tsx` / `feedback.tsx` | 2, 3, 7 |
| Verificação por navegador, responsivo, reduced-motion | todas, consolidado na 9 |
| Preços conferidos contra `BILLING_PRICES` | 5 |
| Aviso de risco preservado | 9 |

**Consistência de nomes:** `Mark`/`Wordmark` (Tarefa 2) são usados com a mesma assinatura nas Tarefas 3 e 4. `useCountUp`/`useReveal` (Tarefa 6) só existem em `landing.tsx`. `ToastProvider`/`useToast`/`LoadingButton`/`ProgressBar` (Tarefa 7) são consumidos com as mesmas assinaturas na Tarefa 8. `Skeleton` é exportado na Tarefa 7 mas não consumido na 8 — é intencional: fica disponível, e forçar um consumidor artificial seria pior.

**Nota sobre TDD:** o projeto não tem suíte de testes, framework, lint nem typecheck (ver `CLAUDE.md`). O ciclo de teste de cada tarefa é a verificação por navegador descrita nos passos, com condições explícitas e verificáveis em vez de inspeção subjetiva. Introduzir um framework de teste está fora do escopo deste trabalho.
