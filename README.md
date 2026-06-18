# MYLoto

dApp de lotería estilo Powerball sobre la red Fractal Bitcoin.

## Setup

Ver `docs/superpowers/specs/2026-06-18-foundation-and-rpc-client-design.md` §9.

## Scripts

- `pnpm install` — instalar dependencias
- `pnpm db:migrate` — aplicar migraciones de DB
- `pnpm dev` — arrancar backend en :3000
- `pnpm test` — tests unitarios
- `RUN_INTEGRATION=1 pnpm test:integration` — tests contra nodo real + DB real

## Estado del proyecto

Ciclo 1 (Fundación + Cliente RPC) en progreso. Ver
`docs/superpowers/plans/2026-06-18-foundation-and-rpc-client.md`.
