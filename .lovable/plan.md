
# Melhorias sugeridas — INA Escalas

Levantamento com base na Home, Calendário, Escalas, Membros e Ministérios. Agrupei por impacto para você escolher o que priorizar. Nada é implementado até você aprovar.

## 1. Visual / identidade (impacto alto, esforço médio)

- **Hero mais integrado**: hoje a capa é uma imagem estática grande. Proposta: adicionar overlay com degradê `primary → transparent`, título "INA Escalas" + subtítulo dinâmico ("Julho · 12 escalas · 3 confirmadas hoje"), e um botão primário "Ver hoje". Traz contexto imediato ao abrir o app.
- **Cabeçalho refinado**: navegação atual é funcional mas visualmente igual à maioria dos apps. Trocar por barra com pílulas arredondadas, indicador ativo com sublinhado dourado (accent), e ícone da igreja com badge do mês atual.
- **Cards com hierarquia**: padronizar `content-card` com header colorido sutil por seção (verde para calendário, dourado para destaques, ardósia para listas). Ajuda o olho a "escanear" a página.
- **Tokens de sombra e raio**: subir `--radius` para `1rem` nos cards principais e usar `--shadow-elegant` (nova) com tom verde para reforçar identidade.
- **Micro-animações**: fade-in escalonado nas linhas da tabela de destaques, hover-lift nos dias do calendário, pulse suave no dia de hoje.

## 2. Calendário (impacto alto, esforço baixo)

- **Legenda de cores** dos ministérios abaixo do calendário (chips clicáveis que filtram os dias).
- **Marcador "hoje" mais claro**: hoje é um círculo primário. Adicionar rótulo "Hoje" pequeno acima.
- **Preview no hover** (desktop): tooltip com resumo dos ministérios/turnos do dia.
- **Indicador de turno**: pontinho ☀️/🌙 no canto do dia quando há escala de manhã/noite.
- **Swipe entre meses no mobile** (gesto horizontal) além dos botões.

## 3. Home / Dashboard (impacto médio)

- **Stat cards no topo**: 4 cartões pequenos — "Escalas do mês", "Confirmadas", "Pendentes", "Membros ativos" — antes do gráfico de ministérios. Dá visão executiva.
- **Ação rápida flutuante**: FAB "+ Nova escala" no canto inferior direito no mobile (hoje só existe dentro do detalhe do dia).
- **Destaques do mês**: adicionar mini-avatar colorido para o 2º e 3º lugar (hoje só o 1º tem cor), e badge "↑ subiu / novo" comparando com o mês anterior.

## 4. Usabilidade — fluxos (impacto alto)

- **Nova escala em 1 clique**: hoje precisa selecionar dia → abrir detalhe → botão "Nova". Adicionar botão global no header e no FAB, com o campo data pré-preenchido pela seleção atual.
- **Confirmação em massa**: botão "Confirmar todas do dia" já existe na lógica mas não aparece na UI. Expor no header do detalhe.
- **Busca global (⌘K)**: dialog de busca por membro/ministério/data acessível de qualquer tela.
- **Feedback de conflito**: quando um membro já está escalado no mesmo dia, hoje é discreto. Mostrar banner amarelo dentro do dialog com o conflito exato ("Já em Louvor · Manhã").
- **Undo em ações destrutivas**: após deletar escala, toast com "Desfazer" por 5s.

## 5. Mobile (impacto alto, esforço médio)

- **Bottom navigation** em telas pequenas em vez do menu hamburguer — 4 ícones fixos (Início, Escalas, Membros, Ministérios).
- **Cards de escala compactáveis**: mostrar só nome+turno colapsado, expandir ao tocar.
- **Tap targets ≥44px**: alguns ícones (deletar, editar) estão em botões de 32px.

## 6. Acessibilidade & polimento

- **Rótulos ARIA** nos botões só-ícone (deletar, editar, compartilhar).
- **Contraste**: alguns textos `text-muted-foreground` em fundo `muted/30` ficam abaixo de AA — subir para 4.5:1.
- **Focus visible**: adicionar ring dourado (`--accent`) uniforme.
- **`h-dvh`** onde hoje usamos `h-screen` (mobile Safari).

## 7. Dark mode

Hoje temos as variáveis mas nenhum toggle. Adicionar switch no header (persistido em localStorage).

---

## Como quer prosseguir?

Sugiro escolhermos **1 pacote** por rodada. Minha recomendação de sequência:

1. **Rodada 1 — Identidade visual**: hero integrado + cabeçalho refinado + tokens de sombra/raio + micro-animações. Efeito "wow" imediato.
2. **Rodada 2 — Home & Calendário**: stat cards + legenda + preview hover + indicador de turno.
3. **Rodada 3 — Fluxos**: FAB + confirmar-todas visível + undo + busca global.
4. **Rodada 4 — Mobile & acessibilidade**: bottom nav + ARIA + contraste + dark toggle.

Me diga qual rodada começar (ou combine itens específicos) que eu detalho e implemento.
