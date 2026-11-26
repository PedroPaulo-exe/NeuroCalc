# NeuroCalc

Treinamento diário de cálculo mental inspirado no Monkeytype, com foco em velocidade, precisão e consistência.

Desenvolvido em TypeScript, o projeto oferece exercícios matemáticos interativos, leitura de operações em voz alta e reconhecimento de respostas por voz, proporcionando uma experiência dinâmica de treinamento cerebral.

## ✨ Funcionalidades

- **Múltiplas operações:** soma, subtração, multiplicação e divisão.
- **Níveis de dificuldade:** exercícios com diferentes quantidades de algarismos e parcelas.
- **Reconhecimento de voz:** responda às questões e controle o treino usando comandos em português brasileiro.
- **Síntese de voz:** ouça as operações durante os exercícios.
- **Metas diárias:** escolha entre 25, 50, 100 ou 200 questões.
- **Recordes pessoais:** acompanhe seu desempenho e evolução.
- **Persistência local:** progresso, recordes e configurações salvos no navegador.
- **Atalhos de teclado:** navegue pelos exercícios sem interromper o ritmo.

## 🧮 Regras dos exercícios

- **Soma e subtração:** operações com 2, 3 ou 5 parcelas. As subtrações não produzem resultados negativos.
- **Multiplicação:** números com N algarismos multiplicados por números de um algarismo, com multiplicadores de dois algarismos disponíveis no nível 3.
- **Divisão:** operações exatas, sem resto, com o dividendo definido pela quantidade de algarismos selecionada.

## 🛠️ Tecnologias

- TypeScript
- HTML, CSS e JavaScript
- Web Speech API
- LocalStorage

## ⚙️ Desenvolvimento

Requisitos: Node.js e npm.

```bash
npm install
npm run build
```

O processo de build compila `src/main.ts` e gera os arquivos de distribuição em `dist/`, incluindo `dist/soroban.html`.

## 🌐 Deploy

O projeto pode ser publicado na Vercel como uma aplicação web estática.

Configure o projeto com os seguintes parâmetros:

| Configuração | Valor |
|---|---|
| Framework Preset | Other |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

O reconhecimento e a síntese de voz dependem do suporte do navegador às APIs de voz e das permissões concedidas pelo usuário.

## 📌 Sobre o projeto

A proposta é tornar o treino de cálculo mental simples, acessível e consistente, combinando a dinâmica de plataformas de digitação com exercícios matemáticos e recursos de voz.

