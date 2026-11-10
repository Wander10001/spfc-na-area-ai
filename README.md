# SPFC NA ÁREA AI

Projeto independente de mídia de torcedor para organizar pautas e preparar conteúdo original sobre o São Paulo FC.

> Não é um canal oficial do São Paulo FC e não utiliza o escudo oficial nem marcas que sugiram afiliação.

## Radar editorial v2

O radar consulta feeds RSS públicos e gera:
- `output/radar.md`: pautas priorizadas para leitura;
- `output/radar.json`: dados estruturados para etapas futuras.

### Filtros atuais
- Prioriza notícias publicadas nas últimas 36 horas.
- Agrupa títulos muito semelhantes para reduzir matérias repetidas.
- Classifica pautas por categorias editoriais.
- Aplica pontuação simples de atualidade e relevância.
- Limita a lista final às 40 pautas mais bem pontuadas.

A pontuação é heurística, não uma avaliação jornalística nem uma confirmação de veracidade. Abra a fonte original, confirme data, contexto e informação antes de transformar qualquer item em conteúdo. Itens sem data válida são descartados para evitar pautas antigas.

## Executar

Requer Node.js 20 ou superior.

```bash
npm run radar
```

## Automação

O GitHub Actions executa o radar a cada três horas e guarda os resultados como artefato por 14 dias. Também é possível iniciar uma execução manual na aba **Actions**.

## Princípios editoriais

1. Confirmar informações em fontes confiáveis e, quando possível, independentes.
2. Não inventar escalações, lesões, negociações, declarações ou resultados.
3. Produzir comentários, análises e roteiros originais; não copiar matérias nem vídeos.
4. Respeitar direitos autorais, políticas do YouTube e a identidade visual independente do projeto.
5. Exigir revisão humana antes de qualquer publicação.

## Roadmap

- [x] Radar RSS inicial.
- [x] Filtro de atualidade, agrupamento de duplicatas e classificação editorial básica.
- [ ] Melhorar fontes e regras de relevância com base nos resultados reais.
- [ ] Sugestões de títulos e roteiros originais.
- [ ] Fluxo de Shorts com revisão humana.
- [ ] Avaliar publicação/agendamento pela API oficial do YouTube.
