/* ============================================
   MECH//CADET — Dados das Missões (10 FASES)
   ============================================ */
(function (global) {
  'use strict';

  var MC = (global.MC = global.MC || {});

  MC.MISSIONS = [
    // FASE 1 — PRIMEIRO CONTATO
    {
      id: 'fase-01',
      title: 'FASE 1 — PRIMEIRO CONTATO',
      subtitle: 'Aprendendo a Pilotar',
      briefing:
        'Bem-vindo, Cadete! É hora do seu primeiro contato com o Mech. ' +
        'Aprenda a se mover, mirar e atirar. Cada ação precisa acontecer ' +
        'na ordem correta. Este é o princípio da SEQUÊNCIA.',
      objectives: [
        'Movimente-se com W A S D',
        'Mire com o MOUSE',
        'Destrua os drones de treinamento',
        'Alcance a área de sincronização',
      ],
      hints: [
        'Ande com W A S D',
        'Mira: MOUSE',
        'Atirar: CLIQUE ESQUERDO',
      ],
      concept: 'SEQUÊNCIA',
      conceptLine:
        'Cada ordem espera a anterior terminar. É assim que todo programa começa.',
      lesson: [
        'Você está executando uma sequência: mover, mirar e atacar.',
        'A Central libera a próxima ordem quando a anterior termina — ninguém pula etapa.',
        'Tudo segue uma ordem lógica, assim como um algoritmo.',
      ],
      challenge: {
        text: 'Complete a fase sem levar dano',
        key: 'noDamage',
      },
      timeLimit: 180,
      targetTime: 120,
      start: { x: 220, y: 750 },
      type: 'tutorial',
      waypoints: [
        { x: 620, y: 750, radius: 90 },
        { x: 1000, y: 480, radius: 90 },
        { x: 1380, y: 750, radius: 90 },
      ],
      exit: { x: 1500, y: 750, radius: 80 },
      enemies: [
        { type: 'drone', x: 800, y: 600 },
        { type: 'drone', x: 1200, y: 900 },
        { type: 'drone', x: 1500, y: 600 },
      ],
      reward: 300,
    },

    // FASE 2 — ENERGIA
    {
      id: 'fase-02',
      title: 'FASE 2 — ENERGIA',
      subtitle: 'XP, Upgrades e Power-Ups',
      briefing:
        'Agora você vai aprender que derrotar inimigos te torna mais forte. ' +
        'Colete XP, suba de nível e escolha melhorias para o seu Mech. ' +
        'Este é o conceito de VARIÁVEIS: energia, vida, XP, velocidade e poder.',
      objectives: [
        'Derrote os inimigos e colete XP',
        'Suba pelo menos 1 nível',
        'Escolha uma melhoria no Level Up',
        'Sobreviva à onda de drones',
      ],
      hints: [
        'Derrote inimigos para ganhar XP',
        'Ao subir de nível, escolha um UPGRADE',
        'Colete Power-Ups quando aparecerem',
      ],
      concept: 'VARIÁVEIS',
      conceptLine:
        'Valores mudam com o tempo. Energia, vida, XP e dano são variáveis.',
      lesson: [
        'XP é uma variável que aumenta conforme você derrota inimigos.',
        'Seus atributos (vida, velocidade, dano) são variáveis que podem ser modificadas.',
        'Upgrades alteram essas variáveis, tornando seu Mech mais forte.',
      ],
      challenge: {
        text: 'Alcance o Nível 2 antes do fim da fase',
        key: 'reachLevel2',
      },
      timeLimit: 180,
      targetTime: 120,
      start: { x: 200, y: 750 },
      type: 'survival',
      enemies: [
        { type: 'drone', x: 700, y: 500 },
        { type: 'drone', x: 1000, y: 1050 },
        { type: 'drone', x: 1300, y: 600 },
        { type: 'drone', x: 1600, y: 900 },
        { type: 'drone', x: 500, y: 850 },
      ],
      reward: 500,
    },

    // FASE 3 — MOVIMENTO TÁTICO
    {
      id: 'fase-03',
      title: 'FASE 3 — MOVIMENTO TÁTICO',
      subtitle: 'Aprendendo o DASH — 3 Corredores',
      briefing:
        'Chegou a hora de aprender o DASH (ESPAÇO). Você deve atravessar ' +
        '3 CORREDORES DE ENERGIA usando o Dash. Cada corredor só conta ' +
        'se você usar o Dash DENTRO dele. Isso ensina TEMPO e CONTROLE: ' +
        'a habilidade tem cooldown e deve ser usada no momento exato.',
      objectives: [
        'Atravesse o Corredor 1 com DASH (ESPAÇO)',
        'Atravesse o Corredor 2 com DASH (ESPAÇO)',
        'Atravesse o Corredor 3 com DASH (ESPAÇO)',
        'Complete os 3 para sincronizar o sistema de movimento',
      ],
      hints: [
        'DASH: ESPAÇO',
        'O Dash possui COOLDOWN — aguarde recarregar',
        'Entre no corredor ANTES de dar o Dash',
        'Use para atravessar inimigos e projéteis',
      ],
      concept: 'TEMPO / CONTROLE',
      conceptLine:
        'Determinadas ações não podem ser usadas infinitamente. O tempo importa.',
      lesson: [
        'O cooldown limita quando você pode usar o Dash novamente.',
        'Timing é importante: usar no momento certo pode salvar sua vida.',
        'Controle de recursos é uma habilidade essencial.',
      ],
      challenge: {
        text: 'Complete os 3 corredores sem levar dano',
        key: 'noDamage',
      },
      timeLimit: 240,
      targetTime: 150,
      start: { x: 220, y: 750 },
      type: 'tutorial',
      dashZones: [
        { x: 600, y: 600, width: 180, height: 200, label: 'CORREDOR 1' },
        { x: 1000, y: 400, width: 180, height: 200, label: 'CORREDOR 2' },
        { x: 1400, y: 600, width: 180, height: 200, label: 'CORREDOR 3' }
      ],
      dashRequired: true,
      enemies: [
        { type: 'drone', x: 500, y: 850 },
        { type: 'interceptor', x: 900, y: 250 },
        { type: 'drone', x: 1300, y: 850 },
        { type: 'interceptor', x: 1700, y: 400 },
      ],
      reward: 600,
    },

    // FASE 4 — LASER TÁTICO + CAIXAS DE DADOS
    {
      id: 'fase-04',
      title: 'FASE 4 — LASER TÁTICO',
      subtitle: 'SHIFT — Quebre as Caixas de Dados',
      briefing:
        'Você desbloqueou o LASER TÁTICO (SHIFT). Agora deve usá-lo para ' +
        'destruir 3 CAIXAS DE DADOS protegidas. Elas só podem ser abertas ' +
        'com o Laser — tiros normais não funcionam. ' +
        'Isso é uma CONDIÇÃO: "SE alvo é caixa de dados ENTÃO use Laser". ' +
        'Na programação, condições decidem qual código executar.',
      objectives: [
        'Destrua a Caixa de Dados 1 com LASER (SHIFT)',
        'Destrua a Caixa de Dados 2 com LASER (SHIFT)',
        'Destrua a Caixa de Dados 3 com LASER (SHIFT)',
        'Proteja-se dos drones enquanto carrega o Laser',
      ],
      hints: [
        'LASER TÁTICO: SHIFT',
        'Caixas de Dados só quebram com Laser',
        'Tiros normais (CLIQUE) não danificam as caixas',
        'Aguarde o cooldown do Laser entre as caixas',
        'Use Dash para desviar dos drones',
      ],
      concept: 'CONDIÇÃO',
      conceptLine:
        '"Se" algo for verdadeiro, "então" execute uma ação. Isso é uma condição.',
      lesson: [
        'Condições permitem decisões: SE caixa ENTÃO Laser.',
        'O Laser é ferramenta específica — não use em tudo.',
        'Na programação, IF/ELSE controla o fluxo do programa.',
      ],
      challenge: {
        text: 'Destrua as 3 caixas sem deixar o Laser pronto desperdiçado',
        key: 'laserEfficiency',
      },
      timeLimit: 240,
      targetTime: 150,
      start: { x: 200, y: 750 },
      type: 'tutorial',
      laserUnlocked: true,
      dataBoxes: [
        { x: 700, y: 600, radius: 40, hp: 1 },
        { x: 1100, y: 400, radius: 40, hp: 1 },
        { x: 1500, y: 600, radius: 40, hp: 1 }
      ],
      enemies: [
        { type: 'drone', x: 500, y: 850 },
        { type: 'drone', x: 900, y: 250 },
        { type: 'drone', x: 1300, y: 850 },
        { type: 'interceptor', x: 1700, y: 400 },
      ],
      reward: 700,
    },

    // FASE 5 — MINI-CHEFE
    {
      id: 'fase-05',
      title: 'FASE 5 — MINI-CHEFE',
      subtitle: 'PROVE O QUE APRENDEU',
      briefing:
        'É hora do seu primeiro grande teste! Enfrente o WARDEN MK-I. ' +
        'Este mini-chefe possui ESTADOS diferentes: NORMAL → ESCUDO → SOBRECARGA → ' +
        'VULNERÁVEL → RECUPERAÇÃO. Use tudo que aprendeu: Movimento, Tiro, Dash e ' +
        'especialmente o LASER quando ele estiver VULNERÁVEL.',
      objectives: [
        'Enfrente o Warden MK-I',
        'Aguarde o momento de vulnerabilidade',
        'Use o LASER quando o chefe estiver vulnerável',
        'Derrote o Mini-Chefe',
      ],
      hints: [
        'Observe os estados do chefe',
        'Quando o escudo falhar, ele ficará VULNERÁVEL',
        'Use o LASER (SHIFT) na janela de vulnerabilidade',
        'Use DASH para esquivar',
      ],
      concept: 'ESTADOS',
      conceptLine:
        'Objetos podem mudar de comportamento baseado em seu estado atual.',
      lesson: [
        'O chefe alterna entre estados — cada estado tem comportamento diferente.',
        'A vulnerabilidade é uma janela de tempo: você precisa esperar o momento certo.',
        'Você está usando todas as mecânicas aprendidas até agora em conjunto.',
      ],
      challenge: {
        text: 'Derrote o mini-chefe usando o Laser na janela de vulnerabilidade',
        key: 'bossLaserStrike',
      },
      timeLimit: 300,
      targetTime: 180,
      start: { x: 200, y: 750 },
      type: 'boss',
      boss: 'warden',
      bossX: 1000,
      bossY: 750,
      laserUnlocked: true,
      enemies: [],
      reward: 1000,
    },

    // FASE 6 — ONDAS
    {
      id: 'fase-06',
      title: 'FASE 6 — ONDAS',
      subtitle: 'CICLOS',
      briefing:
        'Após o mini-chefe, a escala aumenta! Enfrente ondas sucessivas de inimigos. ' +
        'Cada onda traz inimigos mais rápidos, de longo alcance e em maior número. ' +
        'Aprenda sobre CICLOS: INIMIGOS → DERROTAR → NOVA ONDA → DERROTAR.',
      objectives: [
        'Sobreviva a todas as ondas de inimigos',
        'Derrote inimigos rápidos e de longo alcance',
        'Gerencie múltiplos inimigos simultaneamente',
        'Complete todas as ondas',
      ],
      hints: [
        'Novas ondas aparecem após derrotar a anterior',
        'Inimigos Runners são rápidos',
        'Shooters atacam de longe',
        'Use Dash e Laser para gerenciar grupos grandes',
      ],
      concept: 'CICLO',
      conceptLine:
        'Ações que se repetem formam um ciclo (loop).',
      lesson: [
        'As ondas formam um ciclo: nasce → derrota → repete.',
        'Em programação, loops evitam repetir código.',
        'Você precisa gerenciar recursos (Dash, Laser) ao longo de múltiplos ciclos.',
      ],
      challenge: {
        text: 'Sobreviva a todas as ondas sem deixar a estação ser atingida',
        key: 'perfectWaves',
      },
      timeLimit: 240,
      targetTime: 180,
      start: { x: 1000, y: 750 },
      type: 'waves',
      laserUnlocked: true,
      waves: [
        { at: 0, enemies: [{ type: 'drone', x: 300, y: 400 }, { type: 'drone', x: 1700, y: 400 }] },
        { at: 15, enemies: [{ type: 'runner', x: 300, y: 1100 }, { type: 'runner', x: 1700, y: 1100 }] },
        { at: 30, enemies: [{ type: 'shooter', x: 300, y: 750 }, { type: 'shooter', x: 1700, y: 750 }] },
        { at: 45, enemies: [{ type: 'sentinel', x: 620, y: 380 }, { type: 'drone', x: 1380, y: 1120 }] },
        { at: 60, enemies: [{ type: 'elite', x: 1000, y: 300 }, { type: 'runner', x: 500, y: 750 }, { type: 'shooter', x: 1500, y: 750 }] },
      ],
      reward: 900,
    },

    // FASE 7 — SENSORES
    {
      id: 'fase-07',
      title: 'FASE 7 — SENSORES',
      subtitle: 'Distância, Direção e Proximidade',
      briefing:
        'Agora você aprenderá sobre SENSORES. Seu Mech recebe informações sobre ' +
        'distância, direção, proximidade e zonas perigosas. Você precisa ' +
        'interpretar essas informações para tomar decisões corretas.',
      objectives: [
        'Interprete as informações dos sensores',
        'Mantenha-se em zonas seguras',
        'Evite zonas perigosas',
        'Complete os objetivos baseados em proximidade',
      ],
      hints: [
        'Preste atenção na distância dos inimigos',
        'Fique próximo aos objetivos quando necessário',
        'Mantenha distância quando muitos inimigos se aproximam',
      ],
      concept: 'SENSORES',
      conceptLine:
        'Robôs recebem informações e tomam decisões com base nelas.',
      lesson: [
        'Sensores detectam distância, direção e proximidade.',
        'Informações da interface ajudam na tomada de decisão.',
        'Interpretar dados é fundamental para robótica.',
      ],
      challenge: {
        text: 'Complete a fase permanecendo sempre na zona segura',
        key: 'staySafeZone',
      },
      timeLimit: 180,
      targetTime: 120,
      start: { x: 200, y: 750 },
      type: 'objective',
      laserUnlocked: true,
      enemies: [
        { type: 'shooter', x: 600, y: 400 },
        { type: 'shooter', x: 1400, y: 1100 },
        { type: 'runner', x: 850, y: 250 },
        { type: 'runner', x: 1150, y: 1250 },
      ],
      reward: 800,
    },

    // FASE 8 — DECISÕES
    {
      id: 'fase-08',
      title: 'FASE 8 — DECISÕES',
      subtitle: 'AND / OR',
      briefing:
        'Chegou a hora das DECISÕES condicionais! Você precisa combinar condições ' +
        'usando AND (E) e OR (OU). Exemplo: "Se a vida estiver baixa OU houver ' +
        'muitos inimigos → usar Dash". "Se inimigo alinhado E Laser carregado → usar Laser".',
      objectives: [
        'Tome decisões baseadas em múltiplas condições',
        'Use Dash quando sua vida estiver baixa',
        'Use Laser quando tiver inimigos alinhados E carregado',
        'Sobreviva à situação combinada',
      ],
      hints: [
        'Vida baixa + muitos inimigos = use DASH',
        'Inimigos alinhados E Laser carregado = use LASER',
        'Pense antes de agir',
      ],
      concept: 'AND / OR',
      conceptLine:
        'Condições podem ser combinadas para decisões mais complexas.',
      lesson: [
        'AND significa "ambas as condições devem ser verdadeiras".',
        'OR significa "pelo menos uma condição deve ser verdadeira".',
        'Decisões complexas são combinações de condições simples.',
      ],
      challenge: {
        text: 'Sobreviva sem usar itens desnecessariamente',
        key: 'efficientDecisions',
      },
      timeLimit: 180,
      targetTime: 120,
      start: { x: 1000, y: 750 },
      type: 'combat',
      laserUnlocked: true,
      enemies: [
        { type: 'elite', x: 600, y: 500 },
        { type: 'shooter', x: 1400, y: 500 },
        { type: 'runner', x: 800, y: 1000 },
        { type: 'shooter', x: 1200, y: 1000 },
      ],
      reward: 900,
    },

    // FASE 9 — ALGORITMO
    {
      id: 'fase-09',
      title: 'FASE 9 — ALGORITMO',
      subtitle: 'Pensar em Ordem',
      briefing:
        'Está na hora de montar um ALGORITMO! Um algoritmo é uma sequência passo a passo ' +
        'para resolver um problema. Você precisa escolher a ORDEM CORRETA das ações: ' +
        'Desviar → Atacar → Coletar → Dash → Laser. Esta é a preparação para o Chefão Final.',
      objectives: [
        'Execute as ações na ordem correta',
        'Combine todas as habilidades aprendidas',
        'Pense antecipadamente antes de agir',
        'Supere o desafio de sequência',
      ],
      hints: [
        'Pense: o que fazer primeiro?',
        'Use Dash para se reposicionar',
        'Guarde o Laser para o melhor momento',
        'Combine Movimento + Dash + Tiro + Laser',
      ],
      concept: 'ALGORITMO',
      conceptLine:
        'Não basta saber o que fazer, é preciso saber QUANDO e EM QUAL ORDEM fazer.',
      lesson: [
        'Um algoritmo é um plano passo-a-passo para resolver um problema.',
        'A ordem das instruções importa muito.',
        'Você precisa pensar estrategicamente, não apenas reativamente.',
      ],
      challenge: {
        text: 'Complete usando todas as habilidades na sequência ideal',
        key: 'perfectSequence',
      },
      timeLimit: 240,
      targetTime: 150,
      start: { x: 200, y: 750 },
      type: 'combat',
      laserUnlocked: true,
      enemies: [
        { type: 'elite', x: 800, y: 600 },
        { type: 'sentinel', x: 1200, y: 850 },
        { type: 'elite', x: 1600, y: 600 },
        { type: 'shooter', x: 1000, y: 400 },
      ],
      reward: 1000,
    },

    // FASE 10 — CHEFÃO FINAL
    {
      id: 'fase-10',
      title: 'FASE 10 — NÚCLEO ZERO',
      subtitle: 'NULL TITAN — Chefão Final',
      briefing:
        'Chegamos ao ápice da campanha, Cadete! Enfrente o NULL TITAN — NÚCLEO ZERO. ' +
        'Este chefe utiliza TODAS as mecânicas que você aprendeu: Movimento, Dash, ' +
        'Tiro, Laser, Estados, Condições, Ciclos, Sensores, AND/OR e Algoritmos. ' +
        'Combine tudo no momento certo para derrotá-lo. ESTA É SUA ÚLTIMA MISSÃO!',
      objectives: [
        'Enfrente o Null Titan',
        'Destrua os Núcleos Externos quando expostos',
        'Use o LASER nos momentos de vulnerabilidade',
        'Sobreviva às ondas de reforços',
        'Execute a sequência final e derrote o Chefão',
      ],
      hints: [
        'Observe todos os estados do chefe',
        'Destrua os núcleos externos quando alinhados',
        'Use LASER (SHIFT) nas janelas de vulnerabilidade',
        'Lide com o chefe E com as ondas simultaneamente',
        'Combine TODAS as suas habilidades',
      ],
      concept: 'COMBINAÇÃO DE TUDO',
      conceptLine:
        'Tudo que você aprendeu tem utilidade agora. É hora de dominar.',
      lesson: [
        'Você está aplicando todas as mecânicas aprendidas nesta jornada.',
        'SEQUÊNCIA, CONDIÇÕES, CICLOS, SENSORES, VARIÁVEIS, ALGORITMOS.',
        'Você não apenas pilotou um Mech. Você aprendeu a pensar como quem constrói um.',
      ],
      challenge: {
        text: 'Derrote o Null Titan dominando todas as mecânicas',
        key: 'defeatNullTitan',
      },
      timeLimit: 600,
      targetTime: 300,
      start: { x: 200, y: 750 },
      type: 'finalBoss',
      boss: 'nullTitan',
      bossX: 1000,
      bossY: 750,
      laserUnlocked: true,
      enemies: [],
      reward: 2000,
    },
  ];

  MC.missionData = {
    byId: function (id) {
      for (var i = 0; i < MC.MISSIONS.length; i++) {
        if (MC.MISSIONS[i].id === id) return MC.MISSIONS[i];
      }
      return null;
    },
    indexOf: function (id) {
      for (var i = 0; i < MC.MISSIONS.length; i++) {
        if (MC.MISSIONS[i].id === id) return i;
      }
      return -1;
    },
  };

})(window);