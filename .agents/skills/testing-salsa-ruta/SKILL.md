---
name: testing-salsa-ruta-report
description: Test the SalsaRuta report page end-to-end. Use when verifying that sales data (draft or completed) is preserved and displayed correctly in the history report after closing a route.
---

# Testing SalsaRuta Report Feature

## Overview
SalsaRuta is a Vite SPA (no backend) that uses localStorage (`ruta-ventas-v2` key) for all data. Testing involves injecting test data, interacting with the UI, and verifying report output.

## Prerequisites
- Node.js installed
- Run `npm install` then `npm run dev` (serves on localhost:5173 or 5174)
- No backend or database needed — all data lives in browser localStorage

## Test Data Injection

Inject test clients via browser console before starting a route:

```javascript
const state = JSON.parse(localStorage.getItem('ruta-ventas-v2') || '{}');
state.clients = [
  { id: 'c1', name: 'Tienda Lopez', routeId: 'r1', address: 'Calle 1', active: true },
  { id: 'c2', name: 'Abarrotes Garcia', routeId: 'r1', address: 'Calle 2', active: true }
];
localStorage.setItem('ruta-ventas-v2', JSON.stringify(state));
```

Then reload the page to pick up the injected data.

**Default data already present:**
- 7 products (p1-p7): Jalapeño Picosón, La de Árbol, La Taquera, Árbol Quemado, La Matona, Chipotle Ahumado, Habanero Extremo (all $12.00)
- 1 route (r1): "Ruta Principal"

## Key Flows to Test

### Draft Sale with "Antes" Data Preserved in Report

This tests that clients visited with only `existenciaAnterior` (stock count) data — without making a sale — are still visible in the history report after route closure.

**Steps:**
1. Click "Iniciar ruta" on home page, confirm "Ruta Principal"
2. Click a client → enter only "Antes" values (leave Surtido/Dev at 0) → click "Guardar borrador"
3. Visit another client normally (enter Surtido values) → click "Marcar visitado"
4. Click "Cerrar ruta y ver reporte" → confirm in dialog

**What to verify on /reporte page:**
- Draft client IS visible (not hidden)
- Status shows "Pendiente (existencia registrada)"
- Detail table (click to expand) has "Antes" column with entered values
- Completed client shows normally with unit count and total

### Completed Sale Flow (Regression)

1. Start route, visit client, enter Antes + Surtido values
2. Click "Marcar visitado"
3. Close route, verify report shows correct totals and "X unidades" status

## Important UI Details

- **Sale dialog fields:** Each product row has Antes, Surt., Dev., Queda columns
- **Save options:** "Guardar borrador" (draft), "Marcar visitado" (complete sale)
- **Report page:** Located at /reporte after closing a route, or accessible via Historial nav
- **Detail expansion:** Click a client name in the report to show per-product breakdown table

## Architecture Notes

- Data types defined in `src/lib/store.ts` — `ClientSale` has `existenciaAnterior`, `surtido`, `devolucion`, `completed`
- Report logic in `src/routes/reporte.tsx` — `hasSale` determines visibility, `hasAntes` detects draft-with-data
- Route lifecycle: active route → `endRoute()` → moved to history array with `endedAt` timestamp
- localStorage key: `ruta-ventas-v2` (Zustand persist store)

## Tips

- If the route page shows "No hay ruta activa", you need to start a route first from the home page
- If no clients appear, verify they were injected with the correct `routeId` matching the route being started
- The app date/time comes from `new Date()` — reports are timestamped with the closure time
- To reset state completely: `localStorage.removeItem('ruta-ventas-v2')` and reload
- The Historial page lists all closed routes; clicking one opens the same report view

## Devin Secrets Needed
None — this is a fully client-side app with no authentication or external services.
