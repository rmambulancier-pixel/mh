# V18.0.17 QA — Widget V3

Source data: MesHeures backup V18.0.16 exported 2026-09-13.

Validated:
- September 2026 TTE through 13/09: 59h00 (6 worked days).
- Active pay period: 24/08/2026, 2 quatorzaines.
- Period TTE: 122h05.
- HS25: 16h00.
- HS50: 26h35.
- Gross estimate from the canonical MesHeures engine: 2,620.39 €.
- Net estimate from the canonical MesHeures engine: 2,129.33 €.
- August 2026 bulletin remains the real bulletin source for August only; it is not used as September paid net.
- JS syntax: all application scripts pass `node --check`.
- Android XML: all XML files parse successfully.
- Web manifest: valid JSON.
- No stale active `18.0.16` / `1816` references remain.

Android compilation is intentionally left to GitHub Actions because this kit does not bundle the Android SDK.
