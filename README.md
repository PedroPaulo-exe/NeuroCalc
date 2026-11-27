# Soroban diário

Treino diário de soroban no estilo do Monkeytype, feito em TypeScript, com leitura das contas em voz alta e respostas por voz.

## Usar agora
Abra `dist/soroban.html` no **Chrome** ou no **Edge**. A primeira conta (soma, 2 algarismos) já está na tela: é só começar a digitar.
Para a voz funcionar, permita o microfone quando o navegador pedir. Se o microfone não funcionar com o arquivo aberto direto,
sirva a pasta: `npx serve dist` e abra http://localhost:3000/soroban.html

## Sessão (página separada: `dist/sessao.html`)
- Botão de play: 10 questões, 40 segundos por questão; se o tempo acabar, conta como erro e mostra a resposta.
- Contas aleatórias: soma e subtração com 2 ou 3 algarismos; multiplicação e divisão com 2 algarismos
  (2 × 1 alg. por padrão, ou 2 × 2 alg.). A divisão é sempre exata e o resultado tem 2 algarismos.
- Pausar (esc), pular e parar. No fim: média de acertos, tempo médio, lista das 10 contas e média geral de todas as sessões.
- Voz: "começar", "pausar", "continuar", "pular", "repetir", "parar" e a resposta falada.
- Código: `src/sessao.ts` + `src/sessao.html`.

## Atalhos (treino livre)
- `tab` reiniciar · `enter`/`espaço` confirmar · `esc` pular · `ctrl+m` liga/desliga o microfone
- A resposta certa avança sozinha. Clique em "hoje …" no topo para mudar a meta diária (25/50/100/200).

## Comandos de voz (pt-BR)
- Fale a resposta: "cinquenta e sete" ou "57"
- "próximo", "repetir", "reiniciar", "parar"
- "soma", "subtração", "multiplicação", "divisão", "aleatório"
- "dois algarismos", "tempo", "contas"

## Regras das contas
- Soma/subtração: 2, 3 ou 5 parcelas com N algarismos; a subtração nunca dá negativo.
- Multiplicação: N algarismos × 1 algarismo (× 2 algarismos no nível 3).
- Divisão: sempre exata; o dividendo tem N algarismos.

## Desenvolver
```
npm install
npm run build     # src/main.ts -> dist/main.js -> dist/soroban.html (arquivo único)
```
Progresso diário, recordes e opções ficam salvos no navegador (localStorage).
