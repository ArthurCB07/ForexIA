# Reposicionamento da Landing — Plano de Implementação (Fase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o MetaTrader do centro da promessa da landing e colocar a prova no lugar dele — backtest, 30 dias em conta demo, relatório diário no WhatsApp e execução automática na corretora vinculada.

**Architecture:** Continuação direta de [2026-08-09-landing-redesign.md](2026-08-09-landing-redesign.md). Toda a landing vive em `src/landing.tsx` e todos os estilos em `src/styles.css`. Nenhum arquivo novo de código é criado; entra apenas uma pasta de assets estáticos em `public/`. Nenhuma rota, contrato de API ou arquivo de backend muda.

**Tech Stack:** React 18, Vite 5, `lucide-react`, `@fontsource`, CSS puro em arquivo único.

Spec: [2026-08-09-landing-reposicionamento-design.md](../specs/2026-08-09-landing-reposicionamento-design.md)

**Ordem de execução:** as Tarefas 10-12 rodam depois da Tarefa 8 do plano anterior e **antes** da Tarefa 9 dele, que é a passada final de responsivo, acessibilidade e limpeza e precisa ver a página no estado definitivo.

## Global Constraints

Valem integralmente as restrições globais do plano da Fase 1 (não editar as cópias obsoletas em `/main.tsx`, `/styles.css` e `patch/`; não tocar em `server.cjs`, `billing/`, `v2/`, `mt5/`, `supabase/` nem em rotas; estilo de código denso preservado; textos e comentários em pt-BR; nenhum hex solto e nenhuma curva de easing literal fora de `:root`; alvo de toque mínimo de 44px; foco visível; sem scroll horizontal em 375px; `prefers-reduced-motion: reduce` deixando tudo visível). Além delas:

- **Nenhuma dependência nova.** O cliente forneceu como referência um componente shadcn + Tailwind 4 + `motion`. Este projeto não usa nenhum dos três e não vai passar a usar — adotá-los descartaria o sistema de tokens construído nas Tarefas 1 a 7. A referência é reproduzida em CSS puro.
- **Nenhuma corretora além das que o cliente informou.** Hoje a lista é exatamente uma: IQ Option. Não acrescente outras, nem a título de exemplo.
- **Nenhuma clonagem de interface de terceiros.** O bloco de relatório usa a linguagem visual do próprio produto e cita o WhatsApp no texto; não imita a interface do WhatsApp.
- **Todo número de desempenho é ilustrativo e rotulado como tal.**
- A frase **"O passado não garante o futuro"** aparece literal na H1 e no CTA final, e **não** substitui o aviso de risco do rodapé, que continua integral.
- Os preços seguem os do backend: criar R$ 0,26 por indicador, backtest R$ 0,10, otimizador R$ 0,50; exemplo de 3 indicadores R$ 0,78 / R$ 0,30 / R$ 1,50.

---

### Task 10: Hero reposicionado e medidor de três camadas

**Files:**
- Modify: `src/landing.tsx` (hero, novo `LP_CAMADAS`, novo componente `Camadas`)
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: tokens de cor e movimento; `useReveal` da Tarefa 6; `ReconPanel` da Tarefa 4.
- Produces: `LP_CAMADAS` e o componente `Camadas`. A Tarefa 12 referencia as camadas nas objeções e reinsere o `ReconPanel` no corpo da página.

- [ ] **Step 1: Nova copy do hero**

Substitua o conteúdo de `.lpHeroTxt` por:

```tsx
    <span className="lpBadge">30 dias na conta demo antes de qualquer risco</span>
    <h1>O passado não garante o futuro. Por isso o robô <span>prova antes</span> de operar com o seu dinheiro.</h1>
    <p>Monte a estratégia sem escrever código, coloque o robô 30 dias na conta demo da sua corretora, acompanhe cada dia pelo relatório no WhatsApp e só então libere a execução automática.</p>
    <div className="lpHeroBtns">
     <button className="lpCta lpBig" onClick={()=>setAuth('signup')}>Começar os 30 dias de teste</button>
     <button className="lpGhost lpBig" onClick={ir('como')}>Ver como funciona</button>
    </div>
    <p className="lpMicro">1º robô e 1º backtest grátis · sem mensalidade · recarga por PIX</p>
```

- [ ] **Step 2: Dados das camadas**

Acima de `Landing`, junto dos outros arrays de conteúdo:

```tsx
// As tres camadas de prova. A ordem e o produto: cada uma so libera a seguinte.
// Numeros ilustrativos — o painel diz isso no rotulo.
const LP_CAMADAS:any[]=[
 ['01','Passado','Backtest no histórico do seu próprio broker','ok','Reconciliado com o Strategy Tester do MT5'],
 ['02','Presente','30 dias operando na conta demo da corretora','ativo','Dia 18 de 30 · acumulado +R$ 412,60'],
 ['03','Futuro','Execução automática na sua conta real','travado','Destrava quando a camada 2 fechar no positivo'],
];
```

- [ ] **Step 3: Componente `Camadas`**

Ocupa o lugar do `ReconPanel` no hero.

```tsx
function Camadas(){
 const ref=useRef<any>(null), [ativo,setAtivo]=useState(false);
 useEffect(()=>{const el=ref.current;if(!el)return;const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){setAtivo(true);io.disconnect()}},{threshold:.4});io.observe(el);return()=>io.disconnect()},[]);
 return <div className="lpCamadas" ref={ref}>
  <div className="lpCamadasHead"><b>Do histórico até a conta real</b><em>números ilustrativos</em></div>
  {LP_CAMADAS.map(([n,titulo,desc,estado,nota]:any,i:number)=><div className={'lpCamada '+estado+(ativo?' on':'')} key={n} style={{'--i':i} as any}>
   <span className="lpCamadaN num">{n}</span>
   <div className="lpCamadaTxt"><b>{titulo}</b><p>{desc}</p><i>{nota}</i></div>
   <span className="lpCamadaIco" aria-hidden="true">{estado==='travado'?<Lock size={16}/>:estado==='ativo'?<Activity size={16}/>:<Check size={16}/>}</span>
  </div>)}
 </div>;
}
```

Acrescente `Lock`, `Activity` e `Check` ao import de `lucide-react` em `src/landing.tsx`.

- [ ] **Step 4: Trocar o ocupante do hero**

Em `.lpHeroArt`, troque `<ReconPanel/>` por `<Camadas/>`. **Não apague `ReconPanel`** — a Tarefa 12 o reposiciona dentro da página como prova da camada 1. Se o build reclamar de componente declarado e não usado, ignore: este projeto não tem typecheck nem lint, e o componente volta a ser usado na tarefa seguinte.

- [ ] **Step 5: Estilos**

```css
/* v128 - medidor de tres camadas: o elemento-assinatura do hero */
.lpCamadas{width:100%;max-width:460px;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:20px}
.lpCamadasHead{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px}
.lpCamadasHead b{font-size:14.5px;font-weight:600}
.lpCamadasHead em{color:var(--muted);font-style:normal;font-size:11.5px}
.lpCamada{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:start;padding:16px 0;border-bottom:1px solid var(--line);opacity:0;transform:translateY(6px);transition:opacity var(--t-4) var(--e-out),transform var(--t-4) var(--e-out);transition-delay:calc(var(--i,0)*130ms)}
.lpCamada.on{opacity:1;transform:none}
.lpCamada:last-child{border-bottom:0;padding-bottom:4px}
.lpCamadaN{font-size:12px;color:var(--muted);letter-spacing:.08em;padding-top:2px}
.lpCamadaTxt b{display:block;font-size:15px;font-weight:600}
.lpCamadaTxt p{margin:3px 0 0;color:var(--muted);font-size:13.5px;line-height:1.5}
.lpCamadaTxt i{display:block;margin-top:7px;font-style:normal;font-size:12.5px;color:var(--muted)}
.lpCamadaIco{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;background:var(--surface-2);border:1px solid var(--line);color:var(--muted);transition:color var(--t-3) var(--e-out),border-color var(--t-3) var(--e-out)}
.lpCamada.ok .lpCamadaIco{color:var(--green);border-color:color-mix(in srgb,var(--green) 40%,transparent)}
.lpCamada.ativo .lpCamadaIco{color:var(--cy-500);border-color:color-mix(in srgb,var(--cy-500) 45%,transparent)}
.lpCamada.ativo .lpCamadaTxt i{color:var(--cy-500)}
.lpCamada.travado .lpCamadaIco{transition-delay:900ms}
.lpCamada.travado.on .lpCamadaIco{color:var(--txt);border-color:var(--line)}
@media(prefers-reduced-motion:reduce){.lpCamada{opacity:1;transform:none;transition:none}}
```

- [ ] **Step 6: Verificar**

1. Console sem erro.
2. A H1 contém a frase "O passado não garante o futuro" literal — confirme com `get_page_text` e cole o trecho.
3. As três camadas aparecem em escada; role para cima e para baixo e confirme que não re-animam.
4. Com `prefers-reduced-motion: reduce`, todas as três camadas têm `opacity` computada `1`. Cole os três valores.
5. Sem scroll horizontal em 375px: cole `scrollWidth` e `clientWidth`.

- [ ] **Step 7: Commit**

```bash
git add src/landing.tsx src/styles.css
git commit -m "feat: hero reposicionado com medidor de tres camadas de prova"
```

---

### Task 11: Relatório no WhatsApp e vitrine de corretoras

**Files:**
- Create: `public/corretoras/.gitkeep`
- Modify: `src/landing.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: tokens; `useReveal` da Tarefa 6.
- Produces: `LP_RELATORIO`, `LP_CORRETORAS`, e os componentes `Relatorio` e `Corretoras`.

- [ ] **Step 1: Bloco de relatório**

```tsx
// Exemplo do relatorio diario que o robo envia. Valores ilustrativos.
const LP_RELATORIO:any[]=[
 ['Operações do dia','3 operações · 2 ganhos · 1 perda'],
 ['Resultado','+R$ 84,30'],
 ['Saldo','R$ 5.412,60'],
 ['Drawdown','3,1%'],
];
function Relatorio(){
 return <div className="lpRel">
  <div className="lpRelHead"><b>Relatório diário · EURUSD M5</b><em>exemplo</em></div>
  {LP_RELATORIO.map(([k,v]:any)=><div className="lpRelLinha" key={k}><span>{k}</span><b className="num">{v}</b></div>)}
  <p className="lpRelPe">Enviado todo dia no fechamento, direto no seu WhatsApp.</p>
 </div>;
}
```

Seção que a envolve, inserida logo depois da seção `#recursos`:

```tsx
  <section id="whatsapp" className="lpSec lpSplit">
   <div>
    <h2 className="lpH2 reveal">O robô te procura. Você não precisa abrir a plataforma.</h2>
    <p className="lpSub reveal">No fechamento de cada dia o relatório chega no seu WhatsApp: quantas operações o robô fez, quanto ganhou ou perdeu, como está o saldo e o quanto o drawdown andou. Se algo sair da curva, você fica sabendo no mesmo dia — não no fim do mês.</p>
   </div>
   <div className="reveal"><Relatorio/></div>
  </section>
```

- [ ] **Step 2: Vitrine de corretoras**

A lista tem exatamente um item hoje. Com um item só, o marquee infinito não faz sentido, então a trilha só anima a partir de dois — com um, o logo centraliza estático dentro do cartão. Isso é comportamento pretendido, não um bug a corrigir.

```tsx
// Corretoras conectaveis. Lista fornecida pelo cliente — nao acrescente nomes.
const LP_CORRETORAS:any[]=[
 ['IQ Option','/corretoras/iq-option.png'],
];
function Corretoras(){
 const varias=LP_CORRETORAS.length>1;
 const trilha=varias?[...LP_CORRETORAS,...LP_CORRETORAS]:LP_CORRETORAS;
 return <div className="lpBrokers">
  <p className="lpBrokersTit">Conecte a sua corretora</p>
  <div className={'lpBrokersJanela'+(varias?' rola':'')}>
   <div className="lpBrokersTrilha">
    {trilha.map(([nome,src]:any,i:number)=><div className="lpBroker" key={nome+i}>
     <img src={src} alt={nome} loading="lazy" onError={(e:any)=>{e.currentTarget.style.display='none';e.currentTarget.parentElement.classList.add('semLogo')}}/>
     <b>{nome}</b>
    </div>)}
   </div>
  </div>
 </div>;
}
```

O `onError` é o que impede um ícone quebrado enquanto o arquivo do logo não estiver em `public/corretoras/`: a imagem some e o nome da corretora aparece no lugar dela.

Seção que a envolve, depois do bloco de WhatsApp:

```tsx
  <section id="corretora" className="lpSec">
   <h2 className="lpH2 reveal">Passados os 30 dias, o robô opera sozinho na sua corretora</h2>
   <p className="lpSub reveal">Você vincula a conta uma vez. O robô executa as ordens conforme a estratégia que você validou — e continua mandando o relatório diário.</p>
   <div className="reveal"><Corretoras/></div>
  </section>
```

- [ ] **Step 3: Criar a pasta de assets**

Crie `public/corretoras/` com um arquivo `.gitkeep` vazio. O arquivo do logo (`iq-option.png`) é fornecido pelo cliente e ainda não está no repositório. O Vite serve `public/` na raiz, então `/corretoras/iq-option.png` resolve sem configuração.

- [ ] **Step 4: Estilos**

```css
/* v128 - relatorio diario */
.lpSplit{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.lpSec.lpSplit .lpH2,.lpSec.lpSplit .lpSub{text-align:left;margin-left:0;margin-right:0}
.lpRel{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:20px;max-width:420px}
.lpRelHead{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--line)}
.lpRelHead b{font-size:14.5px;font-weight:600}
.lpRelHead em{color:var(--muted);font-style:normal;font-size:11.5px}
.lpRelLinha{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)}
.lpRelLinha span{color:var(--muted);font-size:13.5px}
.lpRelLinha b{font-size:15px}
.lpRelPe{margin:14px 0 0;color:var(--muted);font-size:13px;line-height:1.5}
/* v128 - vitrine de corretoras: feixe no perimetro + trilha */
.lpBrokers{position:relative;border:1px solid var(--line);border-radius:20px;background:var(--surface);padding:34px 20px 26px;max-width:760px;margin:0 auto}
.lpBrokers::before{content:"";position:absolute;inset:-1px;border-radius:20px;padding:1px;background:conic-gradient(from 0deg,transparent 0 72%,var(--cy-300) 82%,var(--cyan) 88%,transparent 96% 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;animation:lpFeixe 8s linear infinite;pointer-events:none}
@keyframes lpFeixe{to{transform:rotate(1turn)}}
.lpBrokersTit{position:absolute;top:0;left:50%;transform:translate(-50%,-50%);margin:0;padding:0 14px;background:var(--surface);font-size:15px;font-weight:600;color:var(--txt);white-space:nowrap}
.lpBrokersJanela{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.lpBrokersTrilha{display:flex;align-items:center;justify-content:center;gap:52px;width:max-content;margin:0 auto}
.lpBrokersJanela.rola .lpBrokersTrilha{justify-content:flex-start;margin:0;animation:lpMarquee 22s linear infinite}
.lpBrokersJanela.rola:hover .lpBrokersTrilha{animation-play-state:paused}
@keyframes lpMarquee{to{transform:translateX(-50%)}}
.lpBroker{position:relative;display:flex;align-items:center;gap:12px;flex:0 0 auto;filter:grayscale(1);opacity:.72;transition:filter var(--t-3) var(--e-out),opacity var(--t-3) var(--e-out)}
.lpBroker:hover{filter:none;opacity:1}
.lpBroker img{height:34px;width:auto;display:block}
.lpBroker b{font-size:15px;font-weight:600;color:var(--muted)}
.lpBroker:not(.semLogo) b{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media(max-width:900px){.lpSplit{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){
 .lpBrokers::before{animation:none;background:none}
 .lpBrokersJanela.rola .lpBrokersTrilha{animation:none;justify-content:center;flex-wrap:wrap;width:auto}
}
```

A regra `.lpBroker:not(.semLogo) b` faz o nome virar texto acessível escondido quando o logo carrega — o leitor de tela recebe o nome sem duplicação visual. Quando a imagem falha, o `onError` adiciona `.semLogo` e o nome volta a aparecer.

- [ ] **Step 5: Verificar**

1. Console sem erro. A requisição do logo pode dar 404 enquanto o arquivo não existir — confirme que a página mostra o texto "IQ Option" nesse caso, sem ícone quebrado, e diga no relatório qual dos dois estados você observou.
2. Só existe uma corretora na trilha e ela está centralizada, sem marquee: confirme via `javascript_tool` que `.lpBrokersJanela` **não** tem a classe `rola`.
3. O feixe gira: leia `getComputedStyle(document.querySelector('.lpBrokers'),'::before').animationName` e confirme `lpFeixe`. Cole o valor.
4. Com `prefers-reduced-motion: reduce`, o feixe não anima e o cartão continua legível.
5. `.lpSplit` alinha o texto à esquerda: cole o `textAlign` computado do `.lpH2` dentro dele e o de um `.lpH2` de outra seção, para mostrar que só esta mudou.
6. Sem scroll horizontal em 375px: cole `scrollWidth` e `clientWidth`.

- [ ] **Step 6: Commit**

```bash
git add src/landing.tsx src/styles.css public/corretoras/.gitkeep
git commit -m "feat: relatorio diario no whatsapp e vitrine de corretoras"
```

---

### Task 12: Alinhar as seções existentes ao novo posicionamento

**Files:**
- Modify: `src/landing.tsx` (`LP_STEPS`, `LP_FEATURES`, `LP_OBJ`, faixa de fatos, seção de prova, CTA final)
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `ReconPanel` da Tarefa 4, desalojado do hero pela Tarefa 10; ícones `lucide-react`.
- Produces: nada consumido adiante.

- [ ] **Step 1: Passos terminam em execução, não em exportar arquivo**

```tsx
const LP_STEPS:any[]=[
 ['01','Monte a estratégia','Escolha indicadores e escreva as regras de entrada e saída na tela — ou dite a estratégia para o agente de voz e revise o que ele montou. Sem escrever uma linha de código.'],
 ['02','Teste no passado','Rode o backtest sobre o histórico do seu próprio broker e deixe o otimizador genético varrer gerações de parâmetros até achar o conjunto que sustenta o resultado.'],
 ['03','Prove no presente','Coloque o robô 30 dias na conta demo da sua corretora. Todo dia o relatório chega no WhatsApp com as operações, o resultado e o drawdown.'],
 ['04','Libere o real','Passados os 30 dias com resultado consistente, vincule a conta real e o robô executa sozinho — com o mesmo relatório diário chegando.'],
];
```

Título da seção `#como`: `<h2 className="lpH2 reveal">Quatro etapas entre a ideia e o robô operando</h2>`, subtítulo `<p className="lpSub reveal">Nenhuma delas exige programação, e nenhuma pede que você confie num número sem ter visto o robô operar.</p>`.

- [ ] **Step 2: Três recursos novos**

Acrescente ao final de `LP_FEATURES`, mantendo a forma `[Icone, categoria, titulo, descricao]`:

```tsx
 [MessageCircle,'p','Relatório no WhatsApp','O fechamento de cada dia chega no seu telefone: operações, resultado, saldo e drawdown. Você não precisa abrir a plataforma para saber como foi.'],
 [Link2,'p','Corretora vinculada','Conecte a conta da sua corretora e o robô passa a executar as ordens sozinho, seguindo exatamente a estratégia que você validou.'],
 [CalendarClock,'a','30 dias em demo','Antes de qualquer dinheiro real, o robô opera um mês inteiro em conta demo. Se não sustentar o resultado ali, você descobre sem pagar por isso.'],
```

Acrescente `MessageCircle`, `Link2` e `CalendarClock` ao import de `lucide-react`.

- [ ] **Step 3: Reinserir o painel de reconciliação como prova da camada 1**

O `ReconPanel` saiu do hero na Tarefa 10 e volta aqui, no fim da seção `#como`, com a legenda que explica o que ele prova:

```tsx
   <div className="lpProva reveal">
    <div><h3>O backtest confere com o Strategy Tester</h3><p>A tela de Validação MT5 coloca as duas execuções lado a lado, operação por operação. Divergência aparece — não fica escondida atrás de um número final bonito.</p></div>
    <ReconPanel/>
   </div>
```

```css
/* v128 - prova da camada 1, no fim dos passos */
.lpProva{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;margin-top:34px;padding-top:34px;border-top:1px solid var(--line)}
.lpProva h3{font-size:20px;margin-bottom:10px}
.lpProva p{color:var(--muted);font-size:14.5px;line-height:1.62;margin:0}
@media(max-width:900px){.lpProva{grid-template-columns:1fr}}
```

- [ ] **Step 4: Duas objeções novas**

Insira em `LP_OBJ`, logo depois da primeira entrada:

```tsx
 ['E se o robô perder dinheiro nos 30 dias de teste?','Você descobre isso em conta demo, com dinheiro que não existe. É exatamente para isso que o teste serve. O robô só vai para a conta real depois que você olhar o resultado do mês e decidir liberar — a decisão é sua, não automática.'],
 ['O que a plataforma acessa na minha corretora?','O vínculo serve para enviar as ordens que a sua estratégia gerar e ler as posições e o saldo para montar o relatório. A estratégia que executa é a que você validou nos 30 dias, e você desfaz o vínculo quando quiser.'],
```

- [ ] **Step 5: Faixa de fatos e CTA final**

Faixa (`.lpStrip`), trocando os fatos centrados no MT5:

```tsx
   <div><b className="num">30</b><span>dias em conta demo antes de qualquer risco</span></div>
   <div><b className="num">R$ 0,26</b><span>por indicador para criar — sem mensalidade</span></div>
   <div><b className="num">0</b><span>linhas de código escritas por você</span></div>
   <div><b className="num">1×</b><span>por dia o relatório chega no seu WhatsApp</span></div>
```

CTA final:

```tsx
  <section className="lpFinal">
   <h2>O passado não garante o futuro. Comece a construir o seu.</h2>
   <p>Crie a conta, monte o primeiro robô e rode o primeiro backtest sem pagar nada.</p>
   <div className="lpHeroBtns"><button className="lpCta lpBig" onClick={()=>setAuth('signup')}>Começar os 30 dias de teste</button><button className="lpGhost lpBig" onClick={()=>setAuth('login')}>Já tenho conta</button></div>
  </section>
```

- [ ] **Step 6: Verificar**

1. Console sem erro; nenhum emoji na landing (o `©` do rodapé não conta).
2. `ReconPanel` renderiza uma única vez: confirme `document.querySelectorAll('.lpRecon').length === 1` e cole o número.
3. Os cards de recursos agora são 11 e as quatro tintas continuam distribuídas: cole a contagem por categoria.
4. O aviso de risco do rodapé continua com o texto integral — cole a primeira e a última frase dele.
5. Os preços continuam R$ 0,26 / R$ 0,10 / R$ 0,50 e o exemplo R$ 0,78 / R$ 0,30 / R$ 1,50.
6. Sem scroll horizontal em 375px: cole `scrollWidth` e `clientWidth`.

- [ ] **Step 7: Commit**

```bash
git add src/landing.tsx src/styles.css
git commit -m "feat: secoes alinhadas ao novo posicionamento de prova antes da execucao"
```

---

## Auto-revisão do plano

**Cobertura da spec:**

| Requisito da spec | Tarefa |
|---|---|
| Frase "O passado não garante o futuro" na H1 | 10 |
| Hero sem o MetaTrader como promessa central | 10 |
| Medidor de três camadas como elemento-assinatura | 10 |
| Painel de reconciliação realocado para prova da camada 1 | 10 (sai do hero), 12 (reinserido) |
| Relatório diário no WhatsApp, sem clonar a interface | 11 |
| Vitrine de corretoras com feixe e marquee, em CSS puro | 11 |
| Só IQ Option, sem nomes inventados | 11 |
| Passos terminam em execução automática | 12 |
| Três recursos novos | 12 |
| Duas objeções novas | 12 |
| Aviso de risco preservado | 12 |
| Nenhuma dependência nova | restrições globais desta fase |

**Consistência de nomes:** `Camadas`/`LP_CAMADAS` (Tarefa 10) não são consumidos por outras tarefas. `Relatorio`/`Corretoras`/`LP_RELATORIO`/`LP_CORRETORAS` (Tarefa 11) idem. `ReconPanel` é definido na Tarefa 4, desalojado na 10 e reinserido na 12 — entre a 10 e a 12 ele fica declarado sem uso, o que é aceitável porque o projeto não tem lint nem typecheck; a Tarefa 12 fecha essa lacuna e a Tarefa 9 confirma que não sobrou nada órfão.

**Risco conhecido:** entre a Tarefa 10 e a Tarefa 12 a página fica sem o painel de reconciliação em qualquer lugar. É transitório dentro da branch e some antes do merge, mas se a execução parar no meio, a Tarefa 12 é a que precisa terminar.
