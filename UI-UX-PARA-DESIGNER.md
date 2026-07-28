# 🎯 Briefing & Especificação UX/UI — Copiloto de Reuniões e Entrevistas com IA

> Documento oficial de diretrizes de design, experiência do usuário (UX), arquitetura visual e especificações de interface para o Copiloto de Reuniões com IA.

---

## 1. Contexto do Produto

Estamos desenvolvendo uma extensão para Google Chrome que funciona como um copiloto de reuniões, entrevistas e conversas profissionais.

A aplicação captura o áudio da reunião, realiza transcrição em tempo quase real via Whisper local e utiliza inteligência artificial (Gemini) para gerar sugestões de resposta contextualizadas.

O usuário poderá:

* acompanhar a transcrição;
* visualizar perguntas detectadas;
* receber sugestões de resposta;
* consultar palavras-chave;
* ouvir a resposta por TTS;
* controlar a captura e os recursos da aplicação.

A interface será exibida **sobre a página da reunião**, como um overlay injetado via **Shadow DOM** (para garantir isolamento de estilos contra a página hospedeira como Google Meet, Zoom ou Teams). Ela não deverá parecer uma página tradicional nem um dashboard complexo.

A experiência desejada é semelhante a um:

> **HUD discreto de copiloto**, que acompanha a reunião sem ocupar a atenção do usuário.

---

## 2. Objetivo Principal da UX

Durante uma entrevista ou reunião, o usuário estará:

* ouvindo outra pessoa;
* interpretando a pergunta;
* pensando na resposta;
* olhando para a câmera;
* falando;
* acompanhando a sugestão da IA.

Por isso, a interface deve exigir o mínimo possível de interação.

O usuário não deve precisar navegar entre telas, procurar botões ou interpretar indicadores técnicos durante a conversa.

A interface deve priorizar:

1. entender rapidamente a pergunta;
2. visualizar uma boa forma de iniciar a resposta;
3. acompanhar os principais pontos;
4. ouvir a resposta, caso deseje;
5. controlar o sistema com poucos cliques.

Princípio central:

> **Durante a reunião, o usuário deve principalmente olhar, ouvir e falar — não operar a interface.**

---

## 3. Direção Visual

### Personalidade

A interface deve transmitir:

* calma;
* inteligência;
* discrição;
* confiança;
* rapidez;
* profissionalismo.

Evitar:

* aparência de dashboard corporativo;
* excesso de cards;
* muitos indicadores técnicos;
* excesso de cores;
* efeitos chamativos;
* animações constantes;
* aparência de chatbot tradicional;
* aparência de ferramenta de monitoramento.

A aplicação deve parecer uma ferramenta de apoio silenciosa.

---

## 4. Arquitetura Visual — Sistema de Widgets Independente

A interface não deve ser construída como um único painel contendo todos os recursos.

Ela deverá ser composta por **4 widgets independentes** montados flutuantes sobre a tela.

### Estrutura dos Widgets

```text
Overlay da Extensão (Shadow DOM)
│
├── Widget 1: Barra de Funções (Player / Controles rápidos)
│
├── Widget 2: Painel de Resposta (Prioridade 1 - Frase de Abertura + Resposta + Chips)
│
├── Widget 3: Painel de Transcrição (Secundário - Últimas falas)
│
└── Widget 4: Indicador de Status (Pill de estado simples)
```

Cada widget deverá possuir:

* posição independente;
* possibilidade de ser arrastado (`drag-to-move`);
* possibilidade de ser minimizado;
* possibilidade de ser ocultado;
* tamanho próprio;
* persistência de posição em `localStorage`;
* comportamento responsivo.

Os widgets não precisam ficar agrupados.

### Exemplo de Disposição em Tela (HUD)

```text
                         ┌──────────────────────────┐
                         │ ● Ouvindo                │  ← Widget 4: Status
                         └──────────────────────────┘


┌────────────────────────────────────┐
│ COMO COMEÇAR                       │
│                                    │  ← Widget 2: Painel de Resposta
│ “Eu começaria identificando o      │     (Nível 1 - Frase de Abertura)
│ gargalo atual usando métricas.”    │
│                                    │
│ Depois avaliaria banco, cache,     │  ← Nível 2 - Resposta Completa
│ Redis, filas e escalabilidade.     │
│                                    │
│  Métricas · Redis · Filas          │  ← Nível 3 - Palavras-chave
└────────────────────────────────────┘


┌────────────────────────────────────┐
│ 🎙 Escuta  🔊 Áudio  ▣ Visual  ⋯  │  ← Widget 1: Barra de Funções
└────────────────────────────────────┘


                         ┌──────────────────────────┐
                         │ TRANSCRIÇÃO              │
                         │ Como você escalaria...   │  ← Widget 3: Transcrição
                         └──────────────────────────┘
```

---

## 5. Widget 1 — Barra de Funções

### Objetivo

A barra de funções será um componente independente. Ela não deverá ficar dentro do painel de resposta.

Deverá oferecer acesso rápido às ações utilizadas durante a reunião, funcionando como uma barra de controles de um player de mídia ou de uma chamada de vídeo.

### Estrutura

```text
┌──────────────────────────────────────────┐
│ 🎙 Escuta │ 🔊 Áudio │ ▣ Visual │ ⋯      │
└──────────────────────────────────────────┘
```

### Comportamento

* Formato horizontal de largura compacta;
* Arrastável com posicionamento livre e altura fixa;
* Permanece visível durante a reunião;
* Fundo semitransparente em dark mode com suporte a backdrop-filter (`blur(12px)`);
* Não compete visualmente com o painel de resposta.

### Botões e Ações

#### 1. Controle de Escuta (Captura)
- **Desativado**: `▶ Iniciar`
- **Ativo**: `🎙 Ouvindo`
- **Pausado**: `▶ Retomar`
- **Erro**: `⚠ Reconectar`
*(O estado deve ser compreensível por ícone/texto, sem depender apenas de cor).*

#### 2. Controle de Áudio / TTS
- **Desligado**: `🔇 Áudio`
- **Ligado**: `🔊 Áudio`
- **Durante leitura**: `⏸ Pausar`
- *Menu popover ao clicar:*
  - Estado: `✓ Ligado` | `○ Desligado` | `○ Manual`
  - Velocidade: `0.9×` | `1.0×` | `1.25×` | `1.5×`

#### 3. Controle de Visualização
- *Menu popover ao clicar (seleção explícita):*
  - `✓ Resposta`
  - `○ Resposta + transcrição`
  - `○ Palavras-chave`
  - `○ Transcrição`

#### 4. Menu "Mais" (`⋯`)
- Contém ações menos frequentes:
  - `Gerar sugestão agora`
  - `Fixar resposta`
  - `Ocultar transcrição`
  - `Salvar sessão`
  - `Abrir histórico`
  - `Configurações`
  - `Encerrar sessão`

### Estados Adaptativos da Barra

- **Aguardando**: `🎙 Ouvindo │ 🔊 Áudio │ ▣ Visual │ ⋯`
- **IA Gerando**: `✕ Cancelar │ 🔊 Áudio │ ▣ Visual │ ⋯`
- **TTS Lendo**: `⏸ Pausar │ ↻ Repetir │ 1,25× │ ⋯`
- **Sessão Parada**: `▶ Iniciar │ ⚙ Configurações`

---

## 6. Widget 2 — Painel de Resposta

### Objetivo

É o componente mais importante da interface. Recebe a maior prioridade visual.

O usuário deve conseguir olhar rapidamente e entender em < 2 segundos:
1. qual foi a pergunta;
2. como começar a responder;
3. quais pontos mencionar.

### Estrutura

```text
┌────────────────────────────────────┐
│ ⠿                         —   ×   │  ← Alça de arraste e controles
├────────────────────────────────────┤
│ COMO COMEÇAR                       │
│                                    │  ← Nível 1: Maior contraste e destaque
│ “Eu começaria identificando o      │
│ gargalo atual usando métricas.”    │
│                                    │
├────────────────────────────────────┤
│ RESPOSTA                           │
│                                    │  ← Nível 2: Texto legível e espaçado
│ Depois avaliaria banco de dados,   │
│ cache, Redis, filas e a estratégia │
│ de escalabilidade horizontal.      │
│                                    │
├────────────────────────────────────┤
│ MÉTRICAS  REDIS  FILAS  BANCO      │  ← Nível 3: Chips de escaneamento
└────────────────────────────────────┘
```

### Hierarquia Visual Interna

1. **Nível 1 — Frase de Abertura**: O elemento mais visível (fonte 18–22px, alto contraste). Ajuda o usuário a dar o primeiro passo ao falar.
2. **Nível 2 — Resposta**: Texto principal legível (15–17px), frases curtas e espaçamento generoso.
3. **Nível 3 — Palavras-chave**: Chips legíveis (ex: `Métricas · Redis · Filas`) para escaneamento rápido.

### Estados do Painel de Resposta

- **Vazio**: "Aguardando uma pergunta... A sugestão aparecerá automaticamente quando uma pergunta for identificada."
- **Pergunta Detectada**: "ENTENDI A PERGUNTA: Como você escalaria uma aplicação Laravel? Preparando a melhor sugestão..." (sem tom de alerta estridente).
- **Gerando Resposta**: Frase de abertura imediata + texto surgindo progressivamente via streaming cursor (`▍`).
- **Resposta Pronta**: Exibição hierarquizada dos 3 níveis + botão de leitura TTS.
- **Interrompido**: "A conversa mudou. Preparando uma nova sugestão..." (evitar mensagens técnicas como *Request aborted*).

---

## 7. Widget 3 — Painel de Transcrição

### Objetivo

Permite acompanhar o diálogo transcrito sem competir visualmente com o painel de resposta.

### Estrutura

```text
┌─────────────────────────────────┐
│ ⠿ TRANSCRIÇÃO              — ×  │
├─────────────────────────────────┤
│ ENTREVISTADOR                   │
│ Como você escalaria uma API?    │
│                                 │
│ VOCÊ                            │
│ Eu começaria analisando...      │
│                                 │
│ AGORA                           │
│ E como você faria isso no...    │
└─────────────────────────────────┘
```

### Regras de Transcrição

- Exibir apenas as últimas 2 ou 3 falas recentes por padrão;
- Diferenciar texto parcial (itálico/opacidade reduzida) de texto final;
- Permitir rolagem suave para consultar histórico;
- Ocultar métricas internas (ex: % de confiança do Whisper) na visão principal;
- Permitir minimizar ou fechar de forma independente.

---

## 8. Widget 4 — Indicador de Status

### Objetivo

Mostrar o estado atual da aplicação de forma discreta em uma "pill" minimalista.

### Formatos e Estados

```text
● Ouvindo                 (Verde discreto)
◌ Transcrevendo           (Azul pulsante)
✦ Entendendo a pergunta   (Roxo/Azul)
✦ Preparando resposta     (Roxo brilhante)
🔊 Lendo resposta          (Azul ativo)
⚠ Reconectando            (Amarelo atenção)
○ Pausado                 (Cinza neutro)
```

Evitar listar componentes técnicos brutos (`Whisper 🟢 LLM 🟢 WebSocket 🟢`). Ao clicar na pill, pode-se abrir o detalhamento:

```text
Status da Sessão
- Transcrição: conectada
- IA: conectada
- Servidor local: ativo
- Latência última resposta: 1.4s
```

---

## 9. Comportamento e Persistência dos Widgets

- **Alça de arraste (`⠿`)**: Todos os widgets possuem handle dedicado. Não deve iniciar arraste ao selecionar texto dentro do card.
- **Persistência em `localStorage`**:
  - `copilotWidgetPositions` (x, y de cada um dos 4 widgets)
  - `copilotWidgetStates` (minimizado/visível de cada widget)
  - `copilotActiveLayout` (`default`, `compact`, `reading`, `keywords`)
  - `copilotOpacity` (0.3 a 1.0)
- **Limites de Tela (Clamp)**: Respeitar viewports de 375px a 4K, impedindo que widgets fiquem fora da área visível.

---

## 10. Modos de Layout Rápidos

1. **Padrão**: Resposta no centro-direita, Barra abaixo da resposta, Transcrição no canto inferior direito, Status no topo.
2. **Compacto**: Resposta exibe apenas Frase de Abertura; Barra com ícones compactos; Transcrição oculta.
3. **Leitura**: Resposta expandida; TTS ativado com destaque de frase; Transcrição oculta; Barra reduzida.
4. **Palavras-chave**: Apenas os chips essenciais em foco na tela.

---

## 11. TTS e Acompanhamento Visual

- O TTS funciona como auxílio de áudio e acompanhamento de leitura.
- **Highlight por Frase**: Durante a leitura em voz alta, a frase atual em reprodução ganha destaque sutil (`background: rgba(99, 102, 241, 0.18)`, `border-left: 3px solid #6366f1`).
- O highlight não deve deslocar o layout nem piscar.

---

## 12. Especificações de Cores e Tokens (Dark Mode Pure)

Refatorado com base no sistema de design **UI/UX Pro Max** (`MASTER.md`):

| Categoria | Token CSS | Valor Hex / RGBA | Aplicação |
|---|---|---|---|
| **Fundo Widget** | `--bg-widget` | `rgba(15, 15, 35, 0.88)` | Container dos 4 widgets com `backdrop-filter: blur(12px)` |
| **Borda Widget** | `--border-widget` | `rgba(99, 102, 241, 0.25)` | Borda sutil de 1px |
| **Texto Primário** | `--text-primary` | `#F8FAFC` | Frase de abertura e títulos |
| **Texto Secundário** | `--text-secondary` | `#94A3B8` | Resposta estendida e histórico |
| **Cor Principal / Ação** | `--accent-blue` | `#6366F1` / `#818CF8` | Foco, seleção, botões ativos |
| **Destaque Abertura** | `--highlight-starter` | `#A5B4FC` | Fundo/borda da frase de abertura |
| **Verde Ativo** | `--status-active` | `#22C55E` | Indicador "Ouvindo" e conexão ok |
| **Amarelo Atenção** | `--status-warning` | `#F59E0B` | Pergunta detectada / Reconectando |
| **Vermelho Erro** | `--status-error` | `#EF4444` | Falha de áudio ou desconexão |

---

## 13. Tipografia

- **Família Principal**: `Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Frase de Abertura (Nível 1)**: `18px – 22px`, font-weight `600`, line-height `1.4`
- **Resposta Principal (Nível 2)**: `15px – 17px`, font-weight `400`, line-height `1.6`
- **Transcrição**: `13px – 15px`, font-weight `400`, line-height `1.5`
- **Rótulos e Badges**: `11px – 12px`, font-weight `600`, letter-spacing `0.5px`, uppercase

---

## 14. Sistema de Ícones (Substituição de Emojis por Lucide SVGs)

Conforme a diretriz do **UI/UX Pro Max**, os emojis foram substituídos por ícones vetoriais SVG da biblioteca **Lucide**:

| Função / Botão | Emoji Antigo | Ícone Lucide Recomendações |
|---|---|---|
| Arraste / Drag | `⋮⋮` | `GripVertical` / `GripHorizontal` |
| Escuta / Mic | `🎙` / `▶` | `Mic` / `Play` / `Square` |
| Áudio / TTS | `🔊` / `🔇` | `Volume2` / `VolumeX` / `Pause` |
| Modo Visual | `▣` / `👁` | `Eye` / `Layout` |
| Menu Mais | `⋯` | `MoreHorizontal` / `Settings` |
| Minimizar | `—` | `Minus` |
| Fechar | `×` | `X` |
| Status IA | `✦` | `Sparkles` |

---

## 15. Acessibilidade (WCAG 2.1 AA)

- **Contraste mínimo**: 4.5:1 em todos os elementos de texto.
- **Navegação por Teclado**:
  - `Alt+C` → Alterna visibilidade dos widgets
  - `Alt+S` → Força geração de sugestão imediata
  - `Esc` → Minimiza widgets
  - Focus Ring: `outline: 2px solid #818cf8`, `outline-offset: 2px`
- **ARIA Live Regions**:
  - Resposta em streaming: `aria-live="polite"`
  - Detecção de pergunta: `aria-live="assertive"`
  - Transcrição: `aria-live="polite"`, `role="log"`

---

## 16. Entregáveis Esperados do Designer & Desenvolvedores

1. **Protótipo Interativo dos 4 Widgets**: Demonstrando reposicionamento livre, colapso e transição de estados.
2. **Componentização React no Shadow DOM**:
   - `FunctionBarWidget.tsx`
   - `ResponsePanelWidget.tsx`
   - `TranscriptionWidget.tsx`
   - `StatusIndicatorWidget.tsx`
3. **Persistência de Layouts**: Implementação de gerenciador de posições com fallback para viewports menores.

---

*Documento atualizado com base no Briefing UX/UI e no Design System UI/UX Pro Max (`MASTER.md`).*
