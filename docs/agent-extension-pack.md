# Agent Extension Pack Documentation

This document describes the Agent Extension Pack created for AdTech Flow, fulfilling the DataTalksClub AI Dev Tools Zoomcamp requirements.

---

## 1. Overview

The extension pack equips AI agents with specialized capabilities to interact with, test, and validate programmatic advertising simulations:

1. **Custom Agent Capabilities** (`agent-capabilities/`):
   - OpenRTB 2.5/3.0 schema inspection and validation tools.
   - Auction state machine transition verifier.
   - Mock network route generator for MSW.
2. **Lifecycle Agent Hooks** (`agent-hooks/`):
   - Pre-commit code inspection hook triggering Oxlint.
   - Spec verification hook before code changes are committed.
3. **MCP Server Integration** (`mcp-server/`):
   - A local Model Context Protocol (MCP) server providing agents with tools to run headless auction simulations and retrieve diagnostic logs.

---

## 2. Capabilities Summary

| Capability | Role | Tool Definition |
| :--- | :--- | :--- |
| `validate_openrtb_payload` | Tester / SWE | Validates JSON against official IAB OpenRTB Zod schemas |
| `run_headless_auction` | On-Call / Tester | Executes a full auction loop in headless Node runtime |
| `inspect_sellers_json` | PM / SWE | Parses and verifies vendor nodes against IAB standards |
