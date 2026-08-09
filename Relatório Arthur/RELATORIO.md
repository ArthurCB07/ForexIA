# Relatório — Sistema de Contas, Carteira e Pagamento PIX

**Data:** 08/08/2026
**Projeto:** Forex IA Studio

---

## O que foi feito, em uma frase

O sistema saiu de um "saldo de mentira" guardado num arquivo local e passou a ter **contas de verdade, carteira real e recarga por PIX** com cobrança automática por uso.

---

## 1. Contas de usuário (Supabase)

Antes qualquer pessoa entrava sem senha e o sistema tinha um único "usuário demo".

Agora:

- Cadastro e login com **e-mail e senha** de verdade.
- Cada pessoa tem sua própria conta, saldo e histórico.
- Nova aba **Perfil** na barra lateral (substituiu a antiga aba "Créditos").
- Criar robô, backtest, otimizador e teste real agora **exigem estar logado**.

## 2. Carteira

Cada usuário tem um saldo próprio, guardado no banco de dados online (Supabase), com:

- Saldo atual
- Extrato completo (toda entrada e saída, com data e saldo depois de cada uma)
- Status do teste grátis

## 3. Pagamento por PIX (Mercado Pago)

- Botões rápidos de R$ 20 / R$ 50 / R$ 100, ou valor livre.
- Gera **QR Code** e **código copia-e-cola**.
- O sistema fica verificando sozinho se o pagamento caiu; quando cai, o saldo sobe na hora.
- Rodando em **modo de teste** do Mercado Pago (nenhuma cobrança real acontece).
- Proteção contra crédito duplicado: mesmo se o pagamento for confirmado duas vezes, o valor entra uma vez só.

## 4. Como funciona a cobrança

**Teste grátis (uma vez por conta):**

| Ação | Primeira vez |
|---|---|
| Criar robô | Grátis |
| Backtest | Grátis |
| Otimização genética | Sempre paga |

**Depois do teste grátis, cobra por indicador do robô:**

| Ação | Preço por indicador | Robô com 5 indicadores |
|---|---|---|
| Criar robô | R$ 0,26 | R$ 1,30 |
| Backtest | R$ 0,10 | R$ 0,50 |
| Otimização genética | R$ 0,50 | R$ 2,50 |

Quanto mais indicadores o robô tem, mais caro fica — exatamente como combinado.

**Se faltar saldo:** a tela avisa quanto custa, quanto você tem, e mostra um botão para ir direto recarregar. Antes disso, quando dava erro, a tela simplesmente não dizia nada.

## 5. Visual da tela de login

A tela de login foi refeita: card centralizado com a identidade visual do sistema (logo do robô, azul neon), abas "Entrar / Criar conta", campos maiores com destaque ao clicar, mensagens de erro em caixa colorida e aviso do teste grátis no rodapé.

## 6. "Sessão inválida" — resolvido

Três problemas diferentes causavam isso:

1. **A sessão vencia em 1 hora.** O login guardava uma "chave de renovação", mas o sistema nunca a usava. Depois de 60 minutos, tudo parava de funcionar. Agora o sistema renova sozinho, sem você perceber.
2. **A mensagem enganava.** Qualquer falha — servidor lento, internet oscilando — aparecia como "Sessão inválida, faça login novamente", mesmo com a sessão perfeitamente válida. Agora só diz isso quando é realmente a sessão; o resto vira "tente novamente em instantes".
3. **O servidor estava travando.** O arquivo de dados (`data/db.json`) tinha chegado a **104 MB** e o sistema o lê e regrava inteiro a cada ação. Ele parou de responder por completo.

O que causava o arquivo gigante: cada backtest salvava a lista inteira de operações (uma delas com 50 mil), e o arquivo era gravado com espaçamento que dobrava seu tamanho. Correções: gravação compacta e manutenção das operações apenas dos 3 backtests mais recentes (as métricas de todos continuam guardadas, e o Ranking e a Validação MT5 seguem funcionando). O arquivo caiu de **104 MB para 38 MB** e não cresce mais sem limite.

> Foi feito um backup completo antes de qualquer alteração: `data/db.backup-20260808-213527.json`.

## 7. Correção extra

Encontrei e corrigi um defeito antigo, sem relação com pagamentos: na tela "Criar Robô", a função que carregava o robô selecionado estava quebrada e falhava silenciosamente (nunca preenchia os campos).

---

## Testes realizados

Todos passaram:

| Teste | Resultado |
|---|---|
| Criar conta e entrar direto (sem confirmar e-mail) | OK |
| Sair e entrar de novo | OK |
| 1º robô (grátis) | OK — R$ 0,00 |
| 1º backtest (grátis) | OK — R$ 0,00 |
| 2º robô sem saldo | Bloqueado com aviso de saldo insuficiente |
| Gerar PIX de R$ 50 | QR Code e copia-e-cola gerados |
| Pagamento aprovado | Saldo foi para R$ 50,00 |
| 3º robô com saldo | Cobrou R$ 0,52 → sobrou R$ 49,48 |
| Otimizador | Cobrou R$ 1,00 → sobrou R$ 48,48 |
| Confirmar o mesmo PIX 2× | Creditou uma vez só |
| Usar o sistema sem login | Bloqueado |

---

## Cadastro sem confirmação de e-mail — resolvido

A confirmação de e-mail foi desativada no painel do Supabase. Ao desligar, apareceu um problema: o cadastro dava certo, mas a tela dizia "confirme seu e-mail" e não deixava entrar. Motivo: o Supabase responde em formato diferente quando a confirmação está desligada, e o sistema não reconhecia esse formato. Corrigido — agora quem se cadastra **entra direto**, sem e-mail nenhum.

## O que falta fazer (1 pendência)

**Webhook do Mercado Pago** *(só quando publicar o site)*

Já está pronto no código, mas só funciona quando o sistema estiver num endereço público na internet. Enquanto roda no seu computador, o sistema confirma o pagamento sozinho consultando o Mercado Pago — funciona igual.

---

## Antes de começar a cobrar de verdade

Quando quiser sair do modo de teste, trocar no arquivo `.env` as chaves do Mercado Pago de teste (`TEST-...`) pelas de produção (`APP_USR-...`). O botão "Simular aprovação" desaparece sozinho quando isso for feito — ele só existe no modo de teste.

**Importante:** o arquivo `.env` guarda as senhas do sistema. Ele já está protegido para não ser enviado junto com o código, mas não compartilhe esse arquivo com ninguém.
