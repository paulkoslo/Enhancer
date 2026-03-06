# Excel Enhancement Web App Spec

## 1. Product Framing

This product should be designed as a mini Codex inside a web app, specialized for spreadsheets.

Not a generic chatbot.

Not just a fixed enrichment form.

The right framing is:

- A user uploads a spreadsheet.
- The system understands the table structure.
- The user gives a goal in plain language.
- The system plans the work, writes prompts or code, tests itself on sample rows, explains what it is doing, takes feedback, and then runs the full job in the background.
- The final output is a downloadable enhanced workbook plus a full audit trail.

Core idea:

This is a controlled agentic coding system for structured spreadsheet work.

## 2. Product Intent

Build an end-to-end web application that enhances Excel files row by row using AI research, classification, extraction, and code-driven transformations.

The core user promise:

- Upload an Excel file.
- Describe the task in plain language.
- Watch the agent analyze the file and propose a plan.
- Review and refine the plan, prompt, schema, and execution mode.
- Let the agent test itself on a few rows.
- Approve the final run.
- Watch progress, logs, and sources in real time.
- Download the enriched file.

The product should feel like replacing repetitive junior analyst work, but with better transparency and reproducibility.

## 3. What The Notebook Already Proves

The notebook already validates the base mechanism:

- Load a workbook into a dataframe.
- Use existing columns as row context.
- Call a model with web research.
- Parse the output into structured fields.
- Test on a small sample first.
- Run the same logic over the full sheet in parallel.
- Export an enriched workbook.

That means the fundamental pattern is already correct.

The web app should generalize this pattern into a reusable agent system.

Important constraint:

- The notebook and workbook in this repo are reference artifacts only.
- They help reverse-engineer the current mechanism.
- They must not become product assumptions.
- The app must not hardcode company-specific columns, addresses, country codes, or any schema from the repo example.
- Every run should be driven entirely by the user-uploaded file and the user-approved plan.

## 4. Product Principles

### 4.1 Agentic But Structured

The agent should have meaningful freedom:

- Understand the data.
- Design the task plan.
- Write prompts.
- Write Python code when needed.
- Generate tests.
- Run those tests in a sandbox.
- Inspect failures.
- Patch its own code.

But that freedom should happen inside a clearly structured runtime.

### 4.2 User Control

The user should always be able to see and control:

- What the task is.
- Which sheet is active.
- Which columns are inputs.
- Which columns will be created or modified.
- Which model is selected.
- Which tools are allowed.
- Whether the run is declarative or code-based.
- What happened during the dry run.
- What happened during the full run.

### 4.3 Transparency By Default

The product needs strong observability:

- Visible plan.
- Visible prompts.
- Visible code in sandbox mode.
- Visible tests.
- Visible source URLs and evidence.
- Visible row logs.
- Visible failures and retries.
- Visible estimated spend.

### 4.4 Freedom With Guardrails

The agent may write custom code, but:

- Only inside an isolated sandbox.
- Preferably against an internal SDK.
- Under resource and time limits.
- With controlled network rules.
- With no direct access to long-lived secrets.

### 4.5 Research-First Architecture

Research is the core differentiator of the product.

For enrichment tasks, a Web Research Agent should always be triggered before row-level output is finalized.

That means:

- The system should gather external evidence first.
- It should not rely on pure model recall for factual enrichment.
- Row outputs should be grounded in retrieved sources whenever the task depends on public information.
- Even declarative runs should include an explicit research phase, not just a prompt call.

## 5. Product Thesis

The best implementation is not "a model that directly edits Excel."

It is:

- A planner.
- A web researcher.
- A code author when needed.
- A tester.
- A judge.
- A supervised execution engine.

In other words:

The app should behave like a specialized, web-hosted coding agent for spreadsheet enhancement.

## 6. Core Use Cases

Initial high-value use cases:

- Find the official website for each company.
- Research company size, industry, and product focus.
- Classify companies by sales relevance.
- Tag leads by ICP fit.
- Summarize public information into short structured fields.
- Validate and normalize company metadata.
- Generate short custom descriptions from multiple inputs.

Later expansion:

- Contact enrichment.
- Lead scoring.
- Competitor detection.
- Supplier categorization.
- Multi-sheet workflows.
- Human-in-the-loop review queues.

Note:

- Company enrichment is only one strong example category.
- The product itself should be generic over tabular spreadsheet tasks.
- No app logic should depend on the sample workbook from this repo.

## 7. Modes Of Execution

The system should support two execution lanes.

### 7.1 Declarative Mode

The agent compiles a typed plan:

- Input columns.
- Output columns.
- Prompt templates.
- Research tools.
- Validators.
- Retry rules.

The runtime then executes that plan row by row.

For enrichment tasks, declarative mode still includes a mandatory research phase before output generation.

This is the default mode for most users and most tasks.

### 7.2 Sandbox Script Mode

The agent may write custom Python when the task is too custom for the declarative runtime.

Examples:

- Complex multi-step classification logic.
- Non-trivial column derivations.
- Reusable helper code for special domains.
- Custom validation heuristics.
- Row grouping or deduplication logic.

Script mode should still be structured:

- The agent writes code against an internal `enhancer_sdk`.
- The agent also writes tests or smoke checks.
- The code is run only inside a sandbox.
- The user can inspect and approve it before full execution.

## 8. User Workflow

### 8.1 Upload And Profile

After upload, the backend should:

- Read workbook metadata.
- Detect sheets.
- Detect headers and likely tables.
- Infer column types.
- Show sample rows.
- Estimate row quality and missingness.

The File Analyst agent should then summarize what it believes the workbook contains.

### 8.2 Planning Chat

The user gives a task such as:

- "Research websites, company size, and summaries for these companies."
- "Classify these companies by sales relevance."
- "Create a one-line description for each row based on public information."

The system should convert that into a visible plan, not just a hidden prompt.

### 8.3 Plan Review

The user reviews:

- Proposed output columns.
- Prompt or code approach.
- Execution mode.
- Model choice.
- Tool permissions.
- Sample size.
- Budget estimate.

### 8.4 Dry Run

The system runs a small sample:

- 2 to 5 representative rows.
- Web research is triggered for each sample row.
- Visible inputs and outputs.
- Visible sources.
- Visible raw logs.
- Visible generated code and tests in script mode.

### 8.5 Feedback Loop

The user can say:

- Continue.
- Change the prompt.
- Change the columns.
- Change the model.
- Change the code.
- Make the research stricter.
- Reduce hallucinations.
- Add another output field.

The agent then updates the plan or code and reruns the dry run.

### 8.6 Full Background Run

Once approved:

- Freeze the plan or script version.
- Queue a background run.
- Trigger the research-first row pipeline for each row.
- Execute in parallel under rate limits.
- Stream logs and progress to the UI.
- Persist partial results.
- Allow pause, cancel, retry, and rerun failed rows.

### 8.7 Output

The final result should include:

- The enhanced workbook.
- An audit sheet.
- Run metadata.
- Source evidence.
- Failed-row summary.
- Generated code and tests for script-mode runs.

## 9. Agentic System Structure

The agent system should be explicit. The product should not behave like one undifferentiated chat model.

Recommended agent roles:

### 9.1 Orchestrator Agent

Responsibilities:

- Maintain run state.
- Decide which specialist agent acts next.
- Keep shared context small and structured.
- Enforce approval checkpoints.

This is the top-level controller.

### 9.2 File Analyst Agent

Responsibilities:

- Inspect workbook structure.
- Infer sheet purpose.
- Infer entity type.
- Suggest candidate primary columns.
- Detect likely problems in the data.

### 9.3 Task Planner Agent

Responsibilities:

- Convert user intent into an executable plan.
- Propose output schema.
- Choose declarative mode or script mode.
- Estimate cost, complexity, and runtime.

### 9.4 Prompt And Schema Agent

Responsibilities:

- Write row-level prompts.
- Define output schema.
- Define parsing rules.
- Define validation rules.

### 9.5 Web Research Agent

This is a core agent, not an optional helper.

Responsibilities:

- Turn row context into search and retrieval actions.
- Query approved research tools.
- Gather candidate sources.
- Resolve likely official domains or primary sources.
- Build evidence packs for downstream agents.
- Capture source metadata and provenance.

For any task that depends on public information, this agent should always be triggered.

### 9.6 Code Author Agent

Used only in sandbox script mode.

Responsibilities:

- Write Python code against `enhancer_sdk`.
- Break the task into functions.
- Keep code deterministic and inspectable.
- Generate comments only where they help readability.

### 9.7 Sandbox Test Agent

Used only in sandbox script mode.

Responsibilities:

- Generate smoke tests and small unit checks.
- Run the code on sample rows inside sandbox.
- Verify schema compliance.
- Verify output stability.

### 9.8 Critic Or Judge Agent

Responsibilities:

- Review dry-run outputs.
- Review logs and failures.
- Identify weak prompts or weak code.
- Decide whether to patch, retry, or escalate to user review.

### 9.9 Execution Agent

Responsibilities:

- Run the approved plan or script over all rows.
- Invoke the Web Research Agent or research toolchain before finalizing row outputs.
- Enforce concurrency and budgets.
- Persist row results and evidence.

### 9.10 Recovery Agent

Responsibilities:

- Handle failed rows.
- Retry with adjusted prompts.
- Re-run only failed subsets.
- Surface ambiguous cases to the user.

### 9.11 Export Agent

Responsibilities:

- Merge outputs back into the workbook.
- Add audit sheets.
- Preserve row order.
- Prepare downloadable artifacts.

## 10. Agent State Machine

Recommended states:

- Uploaded
- Profiled
- Planning
- AwaitingPlanApproval
- DryRunPreparing
- DryRunRunning
- DryRunReview
- AwaitingFinalApproval
- FullRunQueued
- FullRunRunning
- RecoveringFailedRows
- Exporting
- Completed
- Failed
- Cancelled

This matters because the product should feel like a disciplined workflow, not an opaque chat session.

## 11. Backend Architecture

Use a modular Python backend.

Recommended stack:

- FastAPI for API endpoints.
- Pydantic for typed schemas.
- Postgres for metadata and run state.
- Redis for queueing and ephemeral coordination.
- Background workers for execution jobs.
- Object storage for inputs, outputs, logs, and artifacts.

Recommended backend modules:

### 11.1 Workbook Ingestion Module

Responsibilities:

- Read `.xlsx`, `.xls`, and `.csv`.
- Detect sheets and table ranges.
- Extract previews.
- Preserve workbook structure for export.

### 11.2 Profiling Module

Responsibilities:

- Infer column types.
- Detect candidate key columns.
- Detect entity columns.
- Score missingness and ambiguity.
- Suggest likely tasks.

### 11.3 Plan Registry

Responsibilities:

- Persist versioned plans.
- Persist execution mode.
- Persist approved prompts.
- Persist approved code artifacts.
- Persist model settings.

### 11.4 Provider Gateway

Responsibilities:

- Route model calls through a provider abstraction.
- Use OpenRouter as the primary model gateway.
- Support direct providers later if needed.
- Track per-run token usage and estimated cost.

### 11.5 Research Orchestrator

Responsibilities:

- Coordinate search, fetch, extraction, and evidence assembly.
- Build evidence packs per row.
- Deduplicate repeated lookups across similar rows.
- Enforce research budgets and request limits.
- Guarantee that enrichment runs pass through a research phase.

### 11.6 Tool Adapter Layer

Responsibilities:

- Web search.
- Page fetch.
- Content extraction.
- HTML to text normalization.
- URL validation.
- Optional domain or company verification.

Important design rule:

Do not make the entire system depend on a model vendor's native search tool.

The research layer should be a backend capability that can feed evidence into any selected model.

### 11.7 Declarative Execution Compiler

Responsibilities:

- Convert an approved plan into row execution instructions.
- Attach prompt templates.
- Attach validators.
- Attach parsing logic.

### 11.8 Sandbox Orchestrator

Responsibilities:

- Create isolated code execution environments.
- Mount the approved input artifacts.
- Run generated code.
- Run generated tests.
- Capture outputs, logs, and failures.
- Destroy the environment after completion.

### 11.9 Row Execution Engine

Responsibilities:

- Execute rows in parallel.
- Call the research orchestrator before model-backed enrichment steps.
- Enforce rate limits.
- Retry transient failures.
- Persist partial results.
- Emit progress events.

### 11.10 Validation Module

Responsibilities:

- Enforce schema.
- Validate URLs.
- Validate enums and ranges.
- Enforce nullability rules.
- Score confidence.
- Trigger retry logic.

### 11.11 Export Module

Responsibilities:

- Merge new columns into the original sheet.
- Preserve row order.
- Add audit tabs.
- Generate final workbook and artifacts.

### 11.12 Settings And Secrets Module

Responsibilities:

- Store encrypted API credentials.
- Store OpenRouter configuration.
- Store model profiles and capability metadata.
- Store budget settings.
- Store workspace-level defaults.

### 11.13 Observability Module

Responsibilities:

- Log run phases.
- Log row events.
- Log tool calls.
- Log model selection.
- Log sandbox output.
- Emit user-facing progress events.

## 12. Sandbox Architecture

If the app is meant to behave like a mini Codex, sandboxing is not optional.

The system needs a real execution boundary.

### 12.1 Base Design

Recommended first implementation:

- Docker-based ephemeral sandbox containers.
- One container per dry run or execution shard.
- Short-lived workspace.
- Read-only mounted input data.
- Writable output directory only.

Longer-term upgrade path:

- MicroVM or stronger sandbox runtime if needed.

### 12.2 What Runs Inside The Sandbox

Inside the sandbox:

- Generated Python code.
- Generated tests.
- `enhancer_sdk`.
- Preinstalled approved Python libraries.
- Sample input rows or full execution shard.

### 12.3 What The Sandbox Must Not Have

The sandbox should not have:

- Direct database access.
- Direct access to raw long-lived API keys.
- Access to application secrets.
- Arbitrary filesystem access outside the mounted workspace.

### 12.4 Resource Limits

Each sandbox run should have:

- CPU limit.
- Memory limit.
- Max wall-clock time.
- Max output size.
- Max network requests.
- Max cost budget.

### 12.5 Network Policy

The network policy should be explicit per run:

- `none`
- `model-only`
- `research-only`
- `restricted-public-web`

All outbound requests should go through a proxy or gateway where possible so they can be logged and limited.

### 12.6 Package Policy

The first version should not allow arbitrary `pip install` from generated code.

Instead:

- Provide a curated base image.
- Provide a rich internal SDK.
- Add new packages centrally when justified.

This improves reproducibility and reduces supply-chain risk.

### 12.7 Artifact Capture

Each sandbox run should save:

- Generated code.
- Generated tests.
- Standard output.
- Standard error.
- Execution logs.
- Input sample snapshot.
- Output sample snapshot.
- Failure tracebacks.

### 12.8 Test Loop

The code-authoring loop should be:

1. Planner defines the task.
2. Code Author writes the script.
3. Sandbox Test Agent writes tests and smoke checks.
4. Sandbox runs the code on sample rows.
5. Critic reviews failures and low-quality outputs.
6. Code Author patches the code.
7. Repeat until quality threshold or budget limit is reached.
8. User approves the frozen artifact.
9. Full run begins.

## 13. Internal SDK

The sandbox should expose an internal Python SDK so the agent writes short, composable code instead of reinventing the whole system.

Example conceptual SDK areas:

- `workbook.load_sheet()`
- `workbook.iter_rows()`
- `workbook.write_columns()`
- `research.search_web()`
- `research.fetch_page()`
- `research.extract_entity_signals()`
- `models.generate_structured()`
- `validation.validate_url()`
- `validation.require_enum()`
- `logging.emit_row_log()`
- `artifacts.save_preview()`

This is the key compromise between freedom and reliability.

The agent still writes code, but most code becomes orchestration and business logic instead of unsafe low-level plumbing.

Important rule:

- Even sandbox-generated scripts should call the shared research SDK and backend research pipeline.
- They should not bypass the research stack with arbitrary ad hoc web logic unless explicitly allowed by policy.

## 14. Model Strategy

The app needs a real model selector, not a hardcoded model string.

### 14.1 Current Default Assumption

As of March 6, 2026, OpenAI's official docs present `gpt-5.4` as the latest flagship model.

That means the spec should treat `gpt-5.4` as the default premium OpenAI option for planning and coding tasks, not `gpt-5.2`.

But the product should never hardcode "newest model wins."

### 14.2 Model Roles

The system should support different models for different roles:

- Planner model
- Prompt/schema model
- Code author model
- Judge model
- Row execution model

This matters because the best coding model is not always the best bulk execution model.

### 14.3 Capability Registry

Maintain capability metadata for each model:

- Provider
- Model id
- Supports structured outputs
- Good at coding
- Good at classification
- Good at extraction
- Good at long-context planning
- Cost tier
- Latency tier
- Recommended max concurrency

### 14.4 Default Model Profiles

Recommended profile system:

- `Best Quality`
- `Balanced`
- `Low Cost`
- `Research Heavy`
- `Coding Heavy`

Each profile maps internal agent roles to model choices.

### 14.5 Fallback Strategy

If a selected model fails, times out, or gets rate-limited:

- Retry within provider policy.
- Fall back to a compatible model if allowed by user settings.
- Record the fallback in the audit log.

## 15. OpenRouter As Primary Model Gateway

OpenRouter should be the primary model gateway in the spec.

Reason:

- Users want model choice.
- Users may already manage spend there.
- It simplifies swapping providers without changing the core product flow.

### 15.1 Provider Architecture

Recommended provider design:

- Frontend exposes model and profile selection.
- Backend resolves that selection through a provider gateway.
- OpenRouter is the first-class backend target.
- Direct provider adapters can be added later.

### 15.2 Important Constraint

Even when model traffic goes through OpenRouter, research tooling should still be owned by the backend when possible.

Reason:

- Different models expose tools differently.
- Native browsing support is inconsistent.
- Backend-owned retrieval is more stable and auditable.

## 16. API Key Management

API key handling needs to be a first-class product feature.

### 16.1 Key Types

The first version should support:

- Workspace OpenRouter API key
- User-specific OpenRouter API key

Later:

- Direct OpenAI keys
- Direct Anthropic keys
- Direct Google keys

### 16.2 Storage Rules

Keys should be:

- Encrypted at rest
- Never stored in plaintext in logs
- Never exposed to the browser after save
- Rotatable
- Scoped to workspace or user

### 16.3 Runtime Rules

Generated code inside the sandbox should not receive raw provider keys.

Instead:

- The sandbox gets a short-lived execution token, or
- All model calls are proxied through the backend gateway

This is important. Otherwise sandboxed code becomes a secret exfiltration risk.

### 16.4 Budget Controls

The product should support:

- Per-run max budget
- Daily or monthly soft limits
- Model allowlists
- Model denylists
- Max concurrency
- User approval for premium runs

## 17. Internal Plan Format

Regardless of execution mode, the system needs a typed internal plan object.

The plan should define:

- Workbook id
- Sheet id
- Row identity strategy
- Execution mode
- Input columns
- Output columns
- Tool permissions
- Prompt templates
- Validation rules
- Test sample rows
- Model mapping by agent role
- Budget policy
- Retry policy
- Export policy

This plan is the contract between planning and execution.

In script mode, the plan also references:

- Generated code artifact id
- Generated test artifact id
- Approved sandbox image
- Network policy
- Resource policy

## 18. Frontend Architecture

Use a Node.js TypeScript frontend.

Recommended stack:

- Next.js
- React
- TypeScript
- Tailwind or a restrained token-based CSS system
- SSE or WebSocket progress updates

### 18.1 Design Direction

The UI should be:

- Clean
- Serious
- Minimal
- Mostly monochrome or warm neutral
- Strong typography
- Thin borders
- Quiet panels
- Very low visual clutter

The aesthetic should feel more like a calm creative tool than a noisy SaaS dashboard.

### 18.2 Primary Screens

Landing page:

- Clear value proposition
- Example workbook tasks
- Minimal visual language

Workbook intake:

- Drag-and-drop upload
- Sheet selector
- Table preview
- Data profile summary

Planning workspace:

- Chat
- Visible plan card
- Output schema editor
- Prompt editor
- Execution mode selector
- Model selector
- Tool permissions

Sandbox review:

- Generated code viewer
- Test viewer
- Dry-run output viewer
- Failure logs
- Approve or patch controls

Live run monitor:

- Progress
- Phase
- Current shard
- Recent row logs
- Failures
- Retry controls

Results page:

- Download workbook
- Inspect audit sheet
- Inspect sources
- Clone as template

Settings:

- OpenRouter key management
- Workspace defaults
- Model profiles
- Budget controls

## 19. UX Modes

To balance power and usability, the UI should expose progressive control.

### 19.1 Simple Mode

User supplies a task.

The system proposes:

- Schema
- Model
- Tools
- Execution plan

The user mainly approves and tweaks.

### 19.2 Advanced Mode

The user can directly edit:

- Prompts
- Schema
- Model mapping
- Tool permissions
- Code mode
- Test requirements
- Retry policy
- Budget limits

This is the right place for the mini Codex experience.

## 20. Data Quality And Trust

This product will fail if quality control is weak.

Required quality features:

- Structured output validation
- URL validation
- Duplicate detection
- Confidence scoring
- Source capture
- Retry logic
- Idempotent reruns
- Partial run recovery
- Output diffing for dry-run revisions

For company enrichment specifically:

- Company names are ambiguous
- Addresses are messy
- Official websites are easy to hallucinate
- Search results often include directories or aggregators

The UI should let users inspect evidence row by row.

## 21. Operational Caveats

Important caveats:

- The hardcoded API key visible in the notebook should be rotated immediately.
- Large files can become expensive quickly.
- Concurrency must be tied to provider limits and budget policy.
- Research-heavy jobs can be slow and noisy.
- Sandbox code execution increases system complexity significantly.
- Too much user freedom can produce unclear or unstable runs unless the workflow is structured.

## 22. Recommended MVP

The MVP should still be ambitious, but scoped.

Recommended v1:

- One active sheet at a time
- Row-wise spreadsheet enhancement
- Planning chat
- Visible internal plan
- OpenRouter-based model selection
- Declarative execution mode
- Sandboxed script mode behind advanced toggle
- Dry runs on sample rows
- Real-time progress
- Audit sheet and downloadable workbook

## 23. Milestones

### Phase 1

Foundation:

- Workbook upload
- Profiling
- Planning chat
- Declarative execution
- Dry-run loop
- Export

### Phase 2

Mini Codex capability:

- Sandbox orchestrator
- Internal SDK
- Code author agent
- Test agent
- Critic loop
- Script artifact review

### Phase 3

Scale and reuse:

- Saved templates
- Team workspaces
- Re-run failed rows
- More providers
- Stronger sandboxing

## 24. Open Decisions

Before implementation, I would lock down:

- Is company enrichment the first narrow wedge, or do we launch generic from day one?
- Is script mode available to all users or only advanced users?
- Do we allow generated code to modify existing columns, or only create new ones?
- Which network policy is allowed for sandbox runs?
- Do we expose code editing to users, or only code viewing plus feedback?
- What is the first supported object storage and queue stack?

## 25. Bottom Line

The right product is not just an "Excel AI tool."

It is a mini Codex specialized for spreadsheet enhancement.

That means:

- Strong planning
- Strong model selection
- Strong sandboxing
- Strong testing
- Strong observability

The notebook already proves the base enrichment loop.

The next leap is to wrap that loop in a clean agent system:

- plan
- code
- test
- judge
- execute
- recover
- export

That is the architecture this spec should optimize for.
