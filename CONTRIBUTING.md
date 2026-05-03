# Contributing to bullpen

Thanks for being here. Bullpen is open-source and contributions are welcome — especially new teammates, better personas, and refined skills.

## Project shape

```
.claude-plugin/    plugin manifest
agents/            64 teammate definitions (.md)
commands/          67 slash commands (.md)
skills/            bullpen-memory + bullpen-learn skills
hooks/             4 shell scripts + hooks.json
scripts/           generators + Pinecone init + fallback store + data files
docs/              specs and design docs
```

## Adding a new teammate

1. Add an entry to `scripts/roster.json`. Required fields: `id`, `name`, `role`, `dept`, `glyph`, `personality`, `stacks`, `intern`, `command`, `verb`.
2. Add a glyph entry in `scripts/glyphs.json` under `by_role`.
3. Run the generators:
   ```bash
   node scripts/gen-agents.js
   node scripts/gen-commands.js
   ```
4. Verify the new files in `agents/<id>.md` and `commands/<command>.md`.
5. Open a PR.

If your teammate needs a special-shaped agent file (like `orchestrator` or `coach`), hand-write `agents/<id>.md` and add the id to the `SKIP` set in `scripts/gen-agents.js`.

## Editing personas

Personality strings live on the agent's `personality` field in `roster.json`. Keep them under 120 chars, one or two punchy sentences. Re-run `gen-agents.js` to regenerate.

## Adding coach messages

`scripts/coach-messages.json` is the message pool. Five trigger keys (`long_session`, `ship_celebration`, `error_streak`, `late_night`, `first_commit`) each holding an array of one-liners. Keep them under 80 chars, warm but never preachy, no emojis (the `(♡)` glyph is enough).

## Skills

`skills/bullpen-memory/SKILL.md` and `skills/bullpen-learn/SKILL.md` are the read/write halves of the learning loop. Keep them tight — these get invoked frequently and must stay token-efficient.

## Testing changes

There are no automated tests yet. Smoke checks before committing:

```bash
# Validate roster integrity
node -e "const r=require('./scripts/roster.json').agents; const ids=new Set(r.map(a=>a.id)); const cmds=new Set(r.map(a=>a.command)); console.assert(ids.size===r.length, 'duplicate ids'); console.assert(cmds.size===r.length, 'duplicate commands'); console.log('roster ok:',r.length)"

# Validate the local fallback store still works
node scripts/pinecone-fallback.js init
node scripts/pinecone-fallback.js upsert test-ns '{"id":"t1","text":"hello world","type":"pattern","agent_role":"test","project_path":"/tmp","created_at":"2026-05-04","session_id":"s","ref_files":""}'
node scripts/pinecone-fallback.js search test-ns "hello"
rm -rf ~/.bullpen/memory
```

## Commit style

Conventional, single-purpose commits. Prefix with the area (`agents:`, `commands:`, `hooks:`, `scripts:`, `skills:`, `docs:`, `chore:`). Body explains the *why* in 2-4 sentences. Bullpen's git history is browsable on purpose.

## License

By contributing, you agree your work will be released under the MIT License. See [LICENSE](LICENSE).
