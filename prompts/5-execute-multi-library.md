# Multi-Library MCP Server Implementation

**Goal**: Transform the tosspayments-only MCP server into a general-purpose multi-library documentation server.

**Requirements** (from docs/goal.md):
1. Add `get-library-list` tool
2. Remove `get-v1-documents` tool
3. Rename `get-v2-documents` → `get-documents` with libraryId parameter
4. Add libraryId parameter to `document-by-id`
5. Generalize `createTossPaymentDocsRepository` for all libraries

---

## Execution Strategy

This implementation uses a **7-phase agent workflow** with quality gates at each stage. Each phase has a specialized agent that executes autonomously and produces verified outputs.

### Success Criteria
- ✅ All 5 requirements implemented
- ✅ TypeScript compiles (0 errors)
- ✅ All tests pass
- ✅ Test coverage >80%
- ✅ Backward compatible (or clear migration path)
- ✅ New library addition = config-only change

---

## Phase 0: Preparation (Manual)

**Execute these commands before starting agents**:

```bash
# 1. Analyze codebase
npx repomix --ignore "./**/*.md"

# 2. Create outputs directory
mkdir -p agent-outputs

# 3. Create git checkpoint
git add .
git commit -m "chore: pre-agent-execution checkpoint"
```

**Verify**:
- `repomix-output.xml` exists (~23,619 tokens)
- `agent-outputs/` directory created
- Git status clean

---

## Phase 1: Architecture Design

**Objective**: Create comprehensive design document for multi-library system.

**Agent**: design-architect

**Prompt**:
```
Use the design-architect agent to create a complete design for the multi-library system.

Context:
- Read repomix-output.xml for full codebase understanding
- Review docs/goal.md for the 5 required changes
- Reference agent-final-plan.md for detailed specifications

Requirements to address:
1. Add get-library-list tool - returns array of library IDs
2. Remove get-v1-documents tool - delete completely
3. Rename get-v2-documents → get-documents - add libraryId parameter
4. Add libraryId to document-by-id - select repository by library
5. Generalize createTossPaymentDocsRepository - accept libraryId and llmsTxtUrl

Design constraints:
- New library addition = ZERO code changes (config only)
- Full TypeScript strict mode compliance
- Zod schema validation for all parameters
- Backward compatibility with existing tosspayments users
- Thread-safe repository caching
- Graceful error handling (partial library failure allowed)

Output: agent-outputs/phase1-design.md with complete specifications
```

**Expected Output**: `agent-outputs/phase1-design.md`

**Verification**: Design document includes all 10 sections from the plan.

---

## Phase 1.5: Design Review

**Objective**: Validate design quality before implementation begins.

**Agent**: design-reviewer

**Prompt**:
```
Use the design-reviewer agent to review the design document.

Review the completed design in agent-outputs/phase1-design.md against these criteria:
- ✅ Completeness: All 5 requirements addressed
- ✅ Type Safety: No 'any' types, full Zod validation
- ✅ Extensibility: New library = config change only
- ✅ Backward Compatibility: Existing users not broken
- ✅ Error Handling: All scenarios covered
- ✅ Architecture Quality: MCP patterns followed
- ✅ Implementation Clarity: No ambiguities

Output: agent-outputs/phase1-review.md with decision (APPROVED/REVISE/ESCALATE)

If REVISE: List specific issues and restart design-architect with feedback.
If APPROVED: Proceed to Phase 2.
If ESCALATE: Ask me the specific question that needs human decision.
```

**Expected Output**: `agent-outputs/phase1-review.md`

**Decision Point**:
- **APPROVED** → Continue to Phase 2
- **REVISE** → Fix issues and re-run design-reviewer
- **ESCALATE** → Answer question and restart appropriate phase

---

## Phase 2: Repository Implementation

**Objective**: Implement repository layer based on approved design.

**Agent**: repository-engineer

**Prompt**:
```
Use the repository-engineer agent to implement the repository layer.

Prerequisites:
- Verify agent-outputs/phase1-review.md shows APPROVED
- Read agent-outputs/phase1-design.md for specifications

Implementation tasks:
1. Create src/config/libraries.ts - Library configuration with Zod validation
2. Refactor src/repository/createDocsRepository.ts - Add libraryId and llmsTxtUrl parameters
3. Create repository manager or cache (based on design: eager or lazy initialization)
4. Update src/repository/docs.repository.ts if design specifies libraryId property
5. Add type definitions as needed

Guidelines:
- Match existing code style (see docs.repository.ts)
- Add JSDoc comments to all public functions
- Use proper error messages with libraryId context
- DO NOT modify tools.ts or cli.ts yet (that's Phase 3)

Output:
- Modified repository files
- agent-outputs/agent3-checklist.md

Verify: Run 'tsc --noEmit' to confirm TypeScript compiles
```

**Expected Output**:
- `src/config/libraries.ts` (new)
- Modified repository files
- `agent-outputs/agent3-checklist.md`

**Verification**: TypeScript must compile (0 errors).

---

## Phase 3: Tool Implementation

**Objective**: Implement MCP tool layer based on approved design and completed repository.

**Agent**: tool-engineer

**Prompt**:
```
Use the tool-engineer agent to implement the tool layer.

Prerequisites:
- Read agent-outputs/agent3-checklist.md for repository API
- Read agent-outputs/phase1-design.md section 5 for tool specifications

Implementation tasks:
1. Update src/tool/tools.ts imports to use new repository API
2. ADD get-library-list tool - returns available libraries with status
3. REMOVE get-v1-documents tool (or keep as deprecated alias per design)
4. RENAME get-v2-documents → get-documents - add libraryId parameter
5. UPDATE document-by-id - add libraryId parameter
6. Update src/bin/cli.ts - register all tool changes
7. Update src/schema/get-document-schema.ts - add libraryId to schemas

Guidelines:
- Match Phase 2 repository API (check agent3-checklist.md)
- Add JSDoc with examples to all tool functions
- User-friendly error messages (suggest 'get-library-list' on errors)
- Follow MCP SDK patterns for tool registration

Output:
- Modified tool and schema files
- agent-outputs/agent4-checklist.md

Verify: Run 'tsc --noEmit' to confirm TypeScript compiles
```

**Expected Output**:
- Modified `src/tool/tools.ts`, `src/bin/cli.ts`, `src/schema/get-document-schema.ts`
- `agent-outputs/agent4-checklist.md`

**Verification**: TypeScript must compile (0 errors).

---

## Phase 4: Implementation Review

**Objective**: Verify implementation matches design and layers integrate correctly.

**Agent**: implementation-reviewer

**Prompt**:
```
Use the implementation-reviewer agent to review the implementation.

Review scope:
- Phase 2 (Repository) and Phase 3 (Tool) implementations
- Read agent-outputs/phase1-design.md as specification source
- Read agent-outputs/agent3-checklist.md and agent-outputs/agent4-checklist.md

Review checklist:
1. Design-Implementation Mapping - All design sections implemented
2. Integration Points - Tool layer correctly uses repository layer
3. Type Safety - Run 'tsc --noEmit', verify 0 errors
4. Backward Compatibility - Existing code paths preserved
5. Code Quality - Style, JSDoc, error messages, no debug code
6. Error Handling - All scenarios from design covered
7. Security - No SSRF, proper validation, safe error messages

Output: agent-outputs/phase4-review.md with decision (PASS/ISSUES_FOUND/CRITICAL)

If ISSUES_FOUND: List specific fixes needed, then re-run after fixes.
If PASS: Proceed to Phase 5.
If CRITICAL: Escalate with explanation.
```

**Expected Output**: `agent-outputs/phase4-review.md`

**Decision Point**:
- **PASS** → Continue to Phase 5
- **ISSUES_FOUND** → Fix and re-review
- **CRITICAL** → Escalate to main session

---

## Phase 5: Test Implementation

**Objective**: Write comprehensive tests for all multi-library functionality.

**Agent**: test-engineer

**Prompt**:
```
Use the test-engineer agent to implement comprehensive tests.

Prerequisites:
- Verify agent-outputs/phase4-review.md shows PASS
- Read agent-outputs/phase1-design.md section 9 for test requirements

Test categories to implement:
1. Library Configuration Tests - src/config/__test__/libraries.test.ts
   - Zod validation, lookup functions, array structure

2. Repository Multi-Library Tests - src/repository/__test__/multi-library.integration.test.ts
   - createDocsRepository with new signature, error handling

3. Tool Multi-Library Tests - Modify src/tool/__test__/tools.test.ts
   - get-library-list, get-documents with libraryId, document-by-id with libraryId

4. Backward Compatibility Tests - src/tool/__test__/backward-compatibility.test.ts
   - Only if design preserved v1/v2 tools

5. Integration Tests - src/__test__/integration.test.ts
   - End-to-end multi-library scenarios, concurrent requests

6. E2E Tests (optional) - src/__test__/e2e.test.ts
   - Mark with .skip for CI, real network calls

Mock strategy:
- Use vi.fn() for fetch (llms.txt and markdown files)
- Create mock data in src/__test__/data/
- No real network calls in unit tests

Output:
- All test files created/modified
- Mock data files in src/__test__/data/
- agent-outputs/agent6-test-summary.md

Verify: Run 'npm test' - all tests must pass
```

**Expected Output**:
- 6-8 new/modified test files
- Mock data files
- `agent-outputs/agent6-test-summary.md`

**Verification**: `npm test` shows all passing.

---

## Phase 6: Final Verification & Commit

**Objective**: Run all verification checks, fix issues, create final commit.

**Agent**: verification-engineer

**Prompt**:
```
Use the verification-engineer agent to run final verification.

Prerequisites:
- Read agent-outputs/agent6-test-summary.md

Verification steps (in order):
1. TypeScript Type Check - 'tsc --noEmit' (expect 0 errors)
2. Linter - 'npm run lint' (expect 0 errors, warnings OK)
3. Build - 'npm run build' (expect dist/ created)
4. Test Suite - 'npm test' (expect all passing)
5. Coverage - 'npm run test:coverage' (expect >80% for new code)

Retry logic:
- Maximum 5 attempts
- Fix errors systematically (one at a time)
- Escalate if same error 3 times
- Escalate immediately for design issues

On success:
- Create git commit with changes
- Commit message: "feat: add multi-library support"
- Include all 5 requirements in commit body
- Add Claude Code footer

On failure:
- Create agent-outputs/phase6-escalation.md
- Document all attempts and root cause
- Recommend next action

Output:
- agent-outputs/phase6-verification.md (success)
- OR agent-outputs/phase6-escalation.md (failure)
- Git commit (if success)
```

**Expected Output**:
- `agent-outputs/phase6-verification.md` (success case)
- Git commit with all changes

**Verification**: All checks green, commit created.

---

## Execution Checklist

Use this checklist to track progress:

```
Phase 0: Preparation
- [ ] Run repomix
- [ ] Create agent-outputs/
- [ ] Git checkpoint created

Phase 1: Design
- [ ] design-architect completed
- [ ] phase1-design.md created

Phase 1.5: Design Review
- [ ] design-reviewer completed
- [ ] Result: APPROVED (or handled REVISE/ESCALATE)

Phase 2: Repository
- [ ] repository-engineer completed
- [ ] agent3-checklist.md shows TypeScript PASS

Phase 3: Tools
- [ ] tool-engineer completed
- [ ] agent4-checklist.md shows TypeScript PASS

Phase 4: Implementation Review
- [ ] implementation-reviewer completed
- [ ] Result: PASS (or handled ISSUES/CRITICAL)

Phase 5: Testing
- [ ] test-engineer completed
- [ ] agent6-test-summary.md shows tests passing

Phase 6: Verification
- [ ] verification-engineer completed
- [ ] All checks passed
- [ ] Git commit created

Final Verification
- [ ] Run 'npm test' - all passing
- [ ] Run 'npm run build' - successful
- [ ] Run 'git log -1' - commit exists
- [ ] Check agent-outputs/ - all 7+ files present
```

---

## Troubleshooting

### If design-reviewer returns REVISE
1. Read agent-outputs/phase1-review.md for issues
2. Restart design-architect with feedback included
3. Re-run design-reviewer

### If implementation-reviewer finds ISSUES
1. Read agent-outputs/phase4-review.md for specific problems
2. Manually fix or ask appropriate agent to fix
3. Re-run implementation-reviewer

### If verification-engineer escalates
1. Read agent-outputs/phase6-escalation.md
2. Follow recommendation (restart phase, modify design, manual intervention)
3. Consider rollback: `git checkout <checkpoint-hash>`

### If tests fail
1. Read test output carefully
2. Check mock setup
3. Verify Phase 2/3 implementation correctness
4. Re-run test-engineer if test logic is wrong

---

## Expected Timeline

| Phase | Agent | Time | Cumulative |
|-------|-------|------|------------|
| 0 | Manual | 1 min | 1 min |
| 1 | design-architect | 8 min | 9 min |
| 1.5 | design-reviewer | 4 min | 13 min |
| 2 | repository-engineer | 8 min | 21 min |
| 3 | tool-engineer | 7 min | 28 min |
| 4 | implementation-reviewer | 5 min | 33 min |
| 5 | test-engineer | 10 min | 43 min |
| 6 | verification-engineer | 5-10 min | 48-53 min |

**Total**: 48-53 minutes (assuming no retries)

---

## Success Validation

After completion, verify:

```bash
# 1. All requirements implemented
npm test  # Should pass
npm run build  # Should succeed

# 2. Check git commit
git log --oneline -1
# Should show: "feat: add multi-library support"

# 3. Verify artifacts
ls agent-outputs/
# Should have: phase1-design.md, phase1-review.md, agent3-checklist.md,
#              agent4-checklist.md, phase4-review.md, agent6-test-summary.md,
#              phase6-verification.md

# 4. Test functionality (manual)
# - get-library-list should return tosspayments
# - get-documents should accept libraryId
# - Adding new library in src/config/libraries.ts should work without code changes
```

---

## Notes

- **Sequential Execution**: Each phase depends on previous phase completion
- **Quality Gates**: Phases 1.5, 4, and 6 are verification gates
- **Autonomous Agents**: Each agent works independently with its own context
- **Error Recovery**: Retry logic and escalation paths built-in
- **Artifact Tracking**: All agents produce documentation for next phase

**Key Principle**: Slow and safe execution with quality checks at every stage prevents expensive rework.
