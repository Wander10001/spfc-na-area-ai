# SPFC NA ÁREA AI

Projeto independente de mídia de torcedor para organizar pautas e preparar conteúdo original sobre o São Paulo FC.

> Não é um canal oficial do São Paulo FC e não utiliza o escudo oficial nem marcas que sugiram afiliação.

## Primeira versão: Radar de pautas

O radar consulta feeds RSS públicos, filtra notícias relacionadas ao São Paulo FC e gera:
- `output/radar.md`: lista legível de pautas para revisão editorial;
- `output/radar.json`: dados estruturados para etapas futuras.

O radar **não publica automaticamente**. Confira a matéria original, a data, o contexto e a confiabilidade antes de transformar qualquer item em conteúdo.

## Executar

Requer Node.js 20 ou superior.

```bash
npm install
npm run radar
```

## Automação

O GitHub Actions executa o radar em intervalos regulares e guarda os resultados como artefato.

## Princípios editoriais

1. Confirmar informações em fontes confiáveis e, quando possível, independentes.
2. Não inventar escalações, lesões, negociações, declarações ou resultados.
3. Produzir comentários, análises e roteiros originais; não copiar matérias nem vídeos.
4. Respeitar direitos autorais, políticas do YouTube e a identidade visual independente do projeto.
5. Exigir revisão humana antes de qualquer publicação.

## Roadmap

- [x] Estrutura inicial e radar RSS.
- [ ] Sugestões de títulos e roteiros originais.
- [ ] Fluxo de Shorts com revisão humana.
- [ ] Publicação/agendamento pela API oficial do YouTube, após validação.
