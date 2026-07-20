# Melhorias adicionais possíveis — INA Escalas

O app já passou por 4 rodadas de polimento visual e usabilidade. Abaixo estão as próximas melhorias mais relevantes, agrupadas por impacto e esforço. Você escolhe quais quer implementar.

## 1. Recorrência e produtividade (alto impacto / médio esforço)

- **Escalas recorrentes**: criar uma escala e replicar automaticamente para as próximas N semanas/meses, mantendo a lógica de sugestão de membros.
- **Modelo de escala fixa (template)**: salvar um "modelo de culto" com ministérios e turnos pré-definidos, aplicando com um clique em uma data.
- **Geração automática em lote**: escolher um intervalo de datas e gerar todas as escalas de uma vez, respeitando a ordem dos ministérios e evitando repetir o mesmo membro em semanas seguidas.

## 2. Controle de disponibilidade (alto impacto / baixo esforço)

- **Datas de indisponibilidade por membro**: no cadastro/edição do membro, marcar dias ou períodos em que ele não pode ser escalado. A sugestão automática e a seleção manual ignoram essas datas.
- **Limite mensal de escalas por membro**: definir um número máximo de escalas no mês; o sistema avisa quando o limite está próximo/atingido.

## 3. Relatórios e visibilidade (alto impacto / baixo esforço)

- **Relatório de frequência**: página/simples seção mostrando total de escalas, última participação e membros que nunca foram escalados.
- **Histórico de alterações (Audit Log)**: reativar a página já existente e adicionar acesso no menu, mostrando quem criou/editou/removeu escalas.
- **Visualização semanal**: alternar a Home entre calendário mensal e lista semanal, mais próxima do uso no celular.

## 4. Compartilhamento e comunicação (médio impacto / baixo esforço)

- **Link público da escala**: gerar um link somente-leitura com a escala do mês para compartilhar no grupo da igreja (sem exigir login).
- **Mensagem de lembrete**: botão "Lembrar" que reenvia a escala do dia selecionado via WhatsApp, usando o texto já existente.
- **Confirmação por status simplificado**: como você removeu os status da Home, podemos deixar apenas "Confirmado / Não confirmado" na página de Escalas, escondendo "Recusado" e "Concluído" se não forem usados.

## 5. Mobile e experiência (alto impacto / baixo esforço)

- **Pull-to-refresh na lista de escalas**: gesto natural no mobile para recarregar dados.
- **Skeleton loading**: estados de carregamento elegantes enquanto os dados vêm do backend.
- **Empty states ilustrados**: telas amigáveis quando não há membros, ministérios ou escalas.
- **PWA básico**: tornar o app instalável no celular com ícone, splash screen e tema escuro/claro.

## 6. Segurança e organização (baixo impacto / médio esforço)

- **Backup e restauração**: exportar/importar todo o banco (membros, ministérios, escalas) em JSON, útil para trocar de dispositivo ou fazer backup manual.
- **Importação de membros por CSV**: colar uma lista de nomes e telefones para cadastrar vários de uma vez.

---

## Recomendação de sequência

Sugiro começar por **disponibilidade + relatório de frequência + visualização semanal**. São três melhorias que reduzem bastante o trabalho manual de quem monta as escalas e ajudam a não esquecer ninguém.

Depois seguimos com **recorrência/templates** e **PWA**.

Me diga quais itens você quer implementar (pode escolher o pacote sugerido ou montar o seu) que eu detalho e aplico.