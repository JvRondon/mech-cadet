# MECH//CADET — Defesa Orbital

Jogo de ação espacial **não letal** para iniciantes (10–12 anos), feito só com
HTML + CSS + JavaScript + Canvas 2D + Web Audio API. **Sem bibliotecas externas,
sem build, sem servidor, sem login.**

---

## Como jogar

### Opção 1 — abrir direto (funciona offline)

Clique duas vezes no **`index.html`**. Pronto.

### Opção 2 — servidor local (recomendado)

```bash
python -m http.server 8000
```

Depois abra <http://localhost:8000>.

### Opção 3 — GitHub Pages

1. Crie um repositório e envie todos os arquivos (não só o `index.html`).
2. Em **Settings → Pages**, escolha *Deploy from a branch* → branch `main`, pasta `/ (root)`.
3. Acesse `https://SEU_USUARIO.github.io/SEU_REPO/`.

Todos os caminhos são relativos (`./js/main.js`), então funciona em subpastas.

---

## Controles

| Ação | Tecla |
|---|---|
| Mover | **W A S D** (ou setas) |
| Mirar | **Mouse** |
| Atirar | **Clique esquerdo** (pode segurar) |
| Dash | **Espaço** |
| Laser tático | **Shift** (recarga de 7s) |
| Interagir | **E** |
| Overdrive | **Q** |
| Pausar | **Esc** |

> **Esc enquanto a tela de level up está aberta é ignorado** — a escolha é
> obrigatória, senão a criança fica presa sem saber por quê.

---

## Missões

Cada missão vem com uma camada de aprendizado: um **conceito** de
programação é apresentado no briefing e explicado na vitória, sempre
ligado ao mecanismo que a criança acabou de usar.

| # | Missão | Conceito | Desafio bônus |
|---|---|---|---|
| 00 | Link de Sincronização | **Sequência** — ordens que esperam umas pelas outras | Abrir a comporta com `E` sozinho |
| 01 | Núcleo Perdido | **Condição** — "se acontecer isso, então faça aquilo" | Terminar com o escudo intacto |
| 02 | Defesa da Estação | **Ciclo (loop)** — a mesma ordem repetida várias vezes | Estação acima de 80% de integridade |
| 03 | Portal Zero | **Algoritmo** — o plano completo, na ordem certa | Chegar à extração em menos de 1min30 |

O desafio bônus vale **+400 pontos** e mostra o resultado mesmo quando não
é cumprido, para a criança ver o que faltou.

A ideia vem do próprio GDD: a criança experimenta primeiro e só depois
descobre o que existe por trás da experiência.

> A campanha completa da V2 tem **10 fases** (43 minutos no total). As fases
> 05 a 10 — incluindo o mini-chefe e o chefe final — ainda estão em
> desenvolvimento; o que existe hoje são as 4 fases acima, já funcionando
> com todos os sistemas da V2.

---

## Sistemas da V2

### Progressão que recompensa matar

- **XP no chão.** Cada inimigo derrubado larga orbes que o jogador coleta
  (ou que vêm até ele, com o ímã). A curva é `26 × 1,42^(nível−1)`, até
  o nível 12.
- **Level up com 3 escolhas.** Ao subir, o jogo **congela** e abre três
  cartas: escudo, dano, cadência, energia, velocidade, laser, ricochete,
  pulso Nova… São 12 upgrades em quatro raridades (comum, incomum, raro,
  épico). O sorteio evita oferecer três opções da mesma categoria, e um
  upgrade já repetido perde peso — a surpresa é o que mantém a tela
  interessante.
- **Power-ups temporários** caídos junto com o XP: ímã, escudo, laser
  rápido, turbo, tempo lento e energia. A escolha é semi-inteligente: com
  o escudo abaixo de 35% o escudo vira 4× mais provável; se o laser está
  longe de carregar, entra o laser rápido.

### Densidade sem virar castigo

Dois sistemas diferentes, com regras diferentes:

- **Enemy Director** (`js/systems/spawner.js`) — agenda ondas contínuas. A
  pressão sobe de **1× a 3×** ao longo da fase, encurtando o intervalo
  entre ondas e aumentando o tamanho do grupo. O centro da onda é o
  **objetivo da missão**, nunca o jogador: a pressão empurra na direção
  do trabalho em vez de punir por estar parado.
- **Activity Director** (`js/systems/activityDirector.js`) — só age quando
  a criança realmente parou de jogar. Escada de 3 s (grupo), 5 s (dica),
  8 s (grupo maior), 12 s (surge). **Nunca pune** — cria estímulo.

Composição de grupo segue a regra dos três papéis: sempre um
**perseguidor**, alternando **ameaça à distância** e **unidade rápida**.
Sem os três a criança não precisa decidir nada.

### Tipos de inimigo

| Tipo | Papel | Fase |
|---|---|---|
| Drone | Perseguidor básico | 01+ |
| Runner | Rápido, pouco HP | 02+ |
| Shooter | Atira de longe, mantém distância | 03+ |
| Tank | Lento, muita vida, resiste ao laser | 04+ |
| Splitter | Ao morrer, solta 2 filhotes | 06+ |
| Hunter | Persegue de forma imprevisível | 07+ |
| Elite | Rajada radial — raríssimo | 08+ |

### Laser tático

Feixe instantâneo (`Shift`) que atravessa todos os inimigos alinhados e
é **interrompido por obstáculos**. Recarga de 7 s. Chefe recebe 25% do
dano por feixe e mini-chefe 60% — o laser ajuda, nunca resolve sozinho.

### Performance

Tudo que é criado em volume passa por **object pooling**
(`js/systems/pool.js`): inimigos, projéteis, orbes de XP e power-ups.
Nada de `new` dentro do loop. O teto de arena é
`difficulty.maxActiveEnemies` (28) e vale para **todo** caminho de
spawn — inclusive o Activity Director.

---

## Estrutura

```
index.html             Telas (menu, boot, briefing, HUD, level up, vitória, ...)
css/main.css           Estilo cockpit / HUD
data/missions.js       Dados das missões
js/config.js           Constantes de balanceamento, cores, inimigos, upgrades
js/utils.js            Matemática e física (círculo × retângulo, segmento)
js/storage.js          localStorage: perfil, ajustes, recordes
js/audio.js            Web Audio API — sons e trilha 100% procedurais
js/particles.js        Sistema de partículas
js/entities.js         Jogador, inimigos, projéteis, comportamento por tipo
js/missions.js         Regras e estados de cada missão
js/renderer.js         Desenho no Canvas 2D + câmera + radar
js/ui.js               HUD, telas de level up, barra de XP, buffs
js/input.js            Teclado e mouse
js/game.js             Loop principal e máquina de estados
js/main.js             Ponto de entrada e tratamento de erros

js/systems/
  pool.js              Pool genérico + pools de projétil/XP/power-up
  upgrades.js          12 upgrades com raridade, sorteio e aplicação
  xp.js                Orbes no chão, ímã, curva de nível
  powerups.js          7 power-ups + escolha ponderada por necessidade
  laser.js             Feixe instantâneo com alcance interrompido
  spawner.js           Pool de inimigos + Enemy Director (ondas)
  activityDirector.js  Escada anti-ociosidade
```

**A ordem de carregamento importa.** `config` → `utils` → `storage` →
`audio` → `particles` → `pool` → `upgrades` → `xp` → `powerups` → `laser`
→ `entities` → `data/missions` → `missions` → `spawner` →
`activityDirector` → `renderer` → `ui` → `input` → `game` → `main`.
Cada arquivo depende do anterior; inverter dois quebra em silêncio.

> **Por que scripts clássicos e não ES Modules?**
> Módulos ES são bloqueados por CORS no protocolo `file://`. Scripts clássicos
> com um namespace `MC` funcionam tanto abrindo o arquivo direto quanto no
> GitHub Pages — requisito do projeto ("abrir index.html e jogar sem instalar nada").

---

## Requisitos

Navegador moderno (Chrome, Edge, Firefox ou Safari dos últimos 2 anos) com
suporte a Canvas 2D. O áudio é gerado em tempo real e só toca depois do primeiro
clique (política de autoplay dos navegadores).

---

## Progresso salvo

O perfil e os recordes ficam em `localStorage` (`mech-cadet.*`).
Para zerar tudo, abra o console (F12) e execute:

```js
Object.keys(localStorage).filter(k => k.startsWith('mech-cadet'))
  .forEach(k => localStorage.removeItem(k));
```

---

## Diagnóstico

Se algo não funcionar, abra o console (F12). O jogo mostra uma tela
**FALHA AO INICIAR** com o motivo, em vez de ficar em branco.
Para depurar o estado do jogo pelo console:

```js
MC.game.state              // cena, jogador, missão, pontuação
MC.game.simulate(30)       // avança 30 segundos de simulação

MC.spawner.stats()         // { free, made } — `made` crescendo sem parar = vazamento
MC.pools.getProjectiles().stats()
MC.spawner.director.stats()
MC.xp.progress(MC.game.state.player)   // 0..1 da barra de XP
```