# Evals

Two runners over one set of cases (`cases.json`), both driving the real page through a fake `document.modelContext` so tests act exactly the way a WebMCP browser does — `registerTool` / `executeTool`, nothing else.

| runner | who decides the calls | what it proves |
|---|---|---|
| `npm run eval` | the case's expected sequence, replayed | tools compose; payments, approvals and errors round-trip; the tool surface changes with page state |
| `npm run eval:llm` | a real model (Anthropic tool use), re-reading the live tool list every turn | the descriptions steer an agent to the right calls — e.g. the day pass when asked to see everything cheaply, no purchase when asked only for a price |

Each case has a prompt, optional `setup` calls (strings like `buy_ticket:van-gogh` or `{ call, params }` objects), optional `human` actions (clicks on the page between setup and the prompt — dropping a tour stop, pointing at a detail), an optional spending `policy`, and expectations: required calls (in order; read-only extras allowed), forbidden calls, a payment cap, the final page state (`wing`, `screen`, `artwork`, `index`, `tickets`, `spotlight`, `docent`, `compare`, `tour`), which tools must / must not be registered afterwards, and whether the last result carried `isError`.

The box office runs in `X402_MODE=mock`: it answers with real x402 v2 `PAYMENT-REQUIRED` headers and accepts any `PAYMENT-SIGNATURE`, so the gallery's full client path (quote → policy → sign → retry → `PAYMENT-RESPONSE`) executes without a chain. Results land in `results/`.

```bash
cd gallery
npm run eval                              # ~15 s, no keys
ANTHROPIC_API_KEY=… npm run eval:llm      # EVAL_MODEL=claude-opus-5 to change model
npm run eval -- policy-ask-decline        # one case
```

## Compatibility check

`npm run compat` asserts the page satisfies the subset ChatGPT's in-app browser documents ([site tools](https://learn.chatgpt.com/docs/webmcp)) and the budgets Chrome publishes ([secure tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools), [build tools](https://developer.chrome.com/docs/ai/webmcp/build-tools)):

- tools registered on `document.modelContext`, in the top-level page, with no iframes and no declarative-form tools (ChatGPT supports none of those)
- every tool name ≤ 30 chars, description ≤ 500, each parameter description ≤ 150
- every read-only tool's output ≤ 1500 chars, checked in more than one page state so the dynamic surface is covered
- schemas rooted at `object`, no `$ref`

It found two real problems on its first run: `list_wings` was returning 4038 characters — the first call any agent makes, nearly 3× the budget — which is now split into `list_wings` (rooms and prices) and `list_artworks` (titles, optionally per wing).
