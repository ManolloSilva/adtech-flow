# Security & Compliance

This directory contains security guidelines, invalid traffic (IVT) prevention rules, and dependency audit protocols for AdTech Flow.

---

## 1. Invalid Traffic (IVT) Prevention

Sending automated or synthetic programmatic traffic to live ad servers violates ad fraud regulations and can trigger immediate domain blacklisting or legal liability.

### Safeguards Implemented:
- **MSW Interception**: The `msw` (Mock Service Worker) interceptor runs at the Service Worker level and intercepts all requests matching `/openrtb25/*`, `/api/*`, and mock SSP endpoints.
- **Fail-Safe Origin Block**: Outbound HTTP requests to external ad servers (`doubleclick.net`, `adnxs.com`, `rubiconproject.com`, `openx.net`, etc.) are explicitly blocked at the network client layer.

---

## 2. Privacy & PII Handling

- **Sellers.json Sanitization**: Small web publishers sometimes list personal owner names or contact email addresses in `sellers.json`. The ETL pipeline strips all email fields and private comments before committing the static dataset.
- **TCF v2.2 Consent Simulation**: All simulated consent strings are watermarked (`TEST_SIMULATION_NON_PROD`) to prevent accidental misuse in real ad-serving environments.

---

## 3. Dependency Security Auditing

All dependencies are audited via `npm audit` during CI runs. Automated Dependabot alerts monitor for known vulnerabilities.
