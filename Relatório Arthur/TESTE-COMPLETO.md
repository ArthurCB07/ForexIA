# Teste completo do sistema — como um usuário de verdade

**Data:** 09/08/2026
**O que foi feito:** percorri o sistema inteiro do zero, criando uma conta nova e usando cada tela até exportar o robô, procurando erros.

---

## Resumo

Percorri **13 etapas**. O fluxo principal funciona de ponta a ponta: criar conta → criar robô → backtest → recarregar via PIX → otimizar → exportar o robô.

Encontrei **6 problemas — todos corrigidos**: 4 direto no teste (2 deles graves) e 2 depois da sua decisão (separação por dono e saldo visível).

---

## Problemas GRAVES que corrigi

### 1. Qualquer pessoa baixava robôs de graça, sem nem ter conta

O mais sério de todos. O endereço que gera o arquivo `.mq5` (o robô pronto para o MetaTrader — o produto final que você vende) **não pedia login nem cobrava nada**. Testei de fora do sistema, sem conta nenhuma, e recebi um robô completo com 5 indicadores.

Ou seja: dava para pular o cadastro inteiro e gerar robôs ilimitados sem pagar um centavo. Isso derrubava todo o modelo de cobrança.

**Corrigido.** Agora exige login. Exportar um robô que você já pagou continua grátis; exportar uma estratégia avulsa (que nunca foi paga) cobra o mesmo que criar um robô — senão bastaria nunca clicar em "Salvar" para não pagar.

Junto com esse, encontrei mais 4 endereços abertos que também fechei: salvar robô otimizado, listar robôs, listar estratégias e listar backtests. **Os 8 endereços sensíveis foram testados e estão protegidos.**

### 2. O backtest testava a estratégia errada — e você pagava por isso

Criei um robô com EMA 20 + RSI 14, fui ao Backtest Lab e cliquei no botão que dizia **"Executar Backtest do Robô"**. Ele rodou — mas testou a estratégia embutida "EMA Cross", **não o meu robô**.

Resultado: gastei meu backtest grátis testando algo que nunca criei, e o sistema cobrou por 1 indicador em vez de 2 (R$ 0,10 em vez de R$ 0,20), porque não recebeu os indicadores do robô.

O problema: ao criar um robô, ele não fica selecionado automaticamente no Backtest Lab, mas o botão continuava prometendo "do Robô".

**Corrigido** em três pontos:
- Com a estratégia embutida escolhida, o botão agora diz "Executar Backtest (estratégia embutida)" e **pergunta antes de cobrar**.
- Com "Robô salvo" escolhido mas nenhum robô selecionado, o sistema bloqueia e avisa.
- Confirmado que, com o robô selecionado, agora envia a estratégia certa e cobra os 2 indicadores corretamente.

---

## Problemas menores que corrigi

### 3. A tela dizia que a otimização era grátis

Ao abrir "Criar Robô", por cerca de 3 segundos o painel de custos mostrava **R$ 0,00 em tudo** — inclusive na otimização genética, que nunca é grátis. Era o tempo de carregar seus dados. Quem olhasse rápido acreditaria que era de graça.

**Corrigido:** agora mostra "..." enquanto carrega.

### 4. Erro do PIX aparecia como "internal_error"

Ao gerar o PIX, o Mercado Pago falhou e a tela mostrou literalmente **"internal_error"** — que não diz nada a ninguém. Era uma falha temporária: na segunda tentativa funcionou normalmente.

**Corrigido:** agora aparece "O Mercado Pago não respondeu agora. Tente gerar o PIX novamente em alguns segundos."

---

## Problemas que dependiam da sua decisão — resolvidos

### 5. Os robôs não tinham dono: todo mundo via os robôs de todo mundo

Existiam **13 robôs e 84 backtests sem dono registrado**, numa lista única. Qualquer usuário logado via, testava, otimizava e exportava os robôs dos outros. Na prática: um cliente pagava R$ 1,30 para criar, e o próximo entrava e exportava de graça. Isso já importava de verdade — sua base tem uma segunda conta real além da sua (`tiago_bit@yahoo.com.br`).

**Resolvido conforme sua escolha (opção a):** todos os 108 registros antigos passaram para a sua conta (`arthurcbrandao2013@gmail.com`) e, daí em diante, cada robô fica com quem o criou.

O que mudou no sistema:
- Todo robô, backtest e robô otimizado agora nasce com o dono gravado.
- As listas de robôs, estratégias e backtests só mostram o que é da conta logada.
- Abrir, otimizar ou salvar robô de outra conta é bloqueado com "Este robô pertence a outra conta".
- Exportar robô de outra conta não sai de graça: cobra como robô novo.

Testado com duas contas: a segunda conta passou a ver **0 robôs e 0 backtests**, levou **403** ao tentar abrir um robô seu pelo ID, e seus 13 robôs continuam íntegros na sua conta.

> Backup automático antes da migração: `data/db.antes-migracao-*.json`. A migração está em `migrar-donos.cjs` e pode ser reexecutada sem duplicar nada.

### 6. Você não via seu saldo enquanto usava o sistema

**Feito:** o saldo agora fica fixo no topo da barra lateral, sempre visível, e é clicável — leva direto ao Perfil para recarregar. Ele se atualiza sozinho a cada troca de tela.

Além do valor, o bloco avisa o estado da conta:
- **"teste grátis disponível"** (verde) enquanto houver criação ou backtest grátis.
- **"recarregue para continuar"** (amarelo) quando o saldo acaba e não há mais teste grátis.

---

## O que testei e está funcionando

| # | Etapa | Resultado |
|---|---|---|
| 1 | Página inicial e menu | OK — todos os links levam ao lugar certo |
| 2 | Validação do cadastro (campos vazios, senha curta) | OK — mensagens claras |
| 3 | Criar conta | OK — entra direto, sem confirmar e-mail |
| 4 | Dashboard | OK — dados e status carregam |
| 5 | Criar robô (1º, grátis) | OK — R$ 0,00, registrado como teste grátis usado |
| 6 | Backtest (1º, grátis) | OK — resultado completo em 4 segundos |
| 7 | 2ª ação sem saldo | OK — bloqueia e mostra "Saldo insuficiente... Recarregue no Perfil" com botão |
| 8 | Gerar PIX | OK — QR code e código copia-e-cola |
| 9 | Pagamento aprovado | OK — saldo foi para R$ 50,00 em 2 segundos, sozinho |
| 10 | Otimizador genético | OK — cobrou R$ 1,00, achou melhoria de R$ 3.338 |
| 11 | Exportar robô .mq5 | OK — arquivo válido de 4 KB |
| 12 | Renovação de sessão | OK — token vencido renova sozinho |
| 13 | Cobrança correta por indicador | OK — 2 indicadores = R$ 0,20 no backtest |

---

## Detalhe pequeno que ficou

Na tela de Perfil, e-mails longos ficam cortados no card ("usuario.novo1786...@gmail.c"). Só visual, não afeta o funcionamento.

---

## Observação sobre cobrança do otimizador

O otimizador **cobra antes de terminar** o trabalho. Se ele falhar no meio, o valor já foi debitado e não há devolução automática. Não aconteceu no teste, mas vale saber. Se quiser, implemento a devolução em caso de falha.
