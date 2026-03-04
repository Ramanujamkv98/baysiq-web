# Baysiq

Upload orders → discover cohorts → archetypes → profit LTV.

Production-ready Next.js (App Router) + TypeScript MVP with shadcn/ui and framer-motion. Designed to run on **AWS Amplify Hosting** with SSR and API routes (Lambda).

## Features

- **CSV upload**: Drag & drop or browse; required columns (case-insensitive): `order_id`, `customer_id`, `order_date`, `product_id`, `product_name`, `gross_revenue`, `discount`, `refund`, `utm_source`, `country`
- **Cost inputs**: COGS %, shipping per order, payment processing %, fixed transaction fee
- **Results**: KPIs (customers, orders, net revenue, profit, repeat %), plus 3 tabs:
  - **Cohorts**: Retention heatmap by month index + cohort profit LTV table
  - **Archetypes**: Top product-pair archetypes (first 30 days); “Label with AI” to name/describe via LLM
  - **LTV**: Profit LTV by cohort (bar chart + table)
- **Summary cards**: Per-tab “Generate summary” calling an LLM for bullets + recommendation

## Setup

```bash
npm install
cp .env.example .env.local   # optional: add OPENAI_API_KEY for LLM features
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable          | Required | Description                                      |
|-------------------|----------|--------------------------------------------------|
| `OPENAI_API_KEY`  | No       | OpenAI API key for LLM routes (archetypes, summary). If missing, those endpoints return a helpful 503. |

## Amplify deployment

1. Connect the repo to AWS Amplify (Git provider or manual).
2. Build settings: Amplify will use the repo-root **amplify.yml**:
   - **preBuild**: `npm ci`
   - **build**: `npm run build`
   - **artifacts**: `.next` (Next.js output)
3. Set **OPENAI_API_KEY** in Amplify → Environment variables (for LLM features).
4. Amplify Hosting runs Next.js with SSR and API routes on Lambda automatically.

### amplify.yml (reference)

- Located at repo root.
- `npm ci` + `npm run build`; artifacts from `.next`.

## API routes

- **POST /api/compute**  
  Body: `{ csvText: string, costs: CostInputs }`. Returns full compute result (KPIs, cohort retention, cohort profit LTV, archetypes, profit LTV by cohort).

- **POST /api/llm/archetypes**  
  Body: `{ patterns: Archetype[] }`. Returns `{ archetypes: { name, description, items }[] }`. Requires `OPENAI_API_KEY`.

- **POST /api/llm/summary**  
  Body: `{ tab: string, metrics: object }`. Returns `{ bullets: string[], recommendation: string }`. Requires `OPENAI_API_KEY`.

All API routes use `export const runtime = "nodejs"` for Amplify Lambda.

## Testing

A sample CSV is included: **sample-orders.csv**. Use it to test upload → cost inputs → Update results → Cohorts / Archetypes / LTV.

Run the small compute test:

```bash
npm run test
```

## Tech stack

- Next.js 15 (App Router), TypeScript
- TailwindCSS, shadcn/ui, framer-motion, recharts
- papaparse (CSV), zod (validation)
- LLM: thin server-only client in `src/lib/llm/client.ts` reading `OPENAI_API_KEY` from env

## License

Private / unlicensed as desired.
