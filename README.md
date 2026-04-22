# Vault Health Auditor

Plugin para Obsidian focado em manutenÃ§Ã£o ativa do vault, qualidade estrutural das notas e reduÃ§Ã£o de dÃ­vida de conhecimento.

## Funcionalidades do MVP

- Auditoria completa e incremental
- Dashboard com score de saÃºde
- DetecÃ§Ã£o de:
  - notas sem revisÃ£o recente
  - links quebrados
  - notas Ã³rfÃ£s
  - frontmatter obrigatÃ³rio ausente
  - notas grandes sem headings
  - pÃ¡ginas com perfil de depÃ³sito
  - resumo ausente
  - claims potencialmente sem suporte

## Scripts

```bash
npm i
npm run dev
npm run build
npm run test:run
npm run lint
```

## Estrutura

O projeto estÃ¡ organizado por camadas:
- `core`: engine, scheduler, snapshots, persistÃªncia
- `rules`: regras de auditoria
- `analyzers`: heurÃ­sticas e parsing
- `ui`: dashboard e settings
- `tests`: unit tests

## PrÃ³ximos passos sugeridos

- Evoluir a heurÃ­stica de link fraco
- Adicionar autofix para frontmatter
- Trocar o dashboard DOM por Svelte real
- Adicionar filtros avanÃ§ados e grÃ¡ficos
- Persistir baseline e tendÃªncias por pasta/tipo
