# Research drop folder (DELL)

Board cron files from the agent lab (`deep-lore-*.md`, `postgame-xray-*.md`, or the JSON schema in `research/README.md`) do **not** appear on The Harmon Line until they are copied here or into repo-local `research/`.

This folder is scanned by `GET /api/research` and `/research`. Missing files produce **NO BRIEF ON THIS FEED YET**. Anomalies, WPA, and scores are never invented.

## Copy onto this machine

```bash
cp /path/to/deep-lore-*.md public/research/
cp /path/to/postgame-xray-*.md public/research/
# or JSON with the schema in research/README.md
```

Then refresh `/research`. Production (`npm run build && npm start`) reads these files from disk on each request.

Optional: set `RESEARCH_DIR` to another folder (for example a lab output directory). `public/research/` is still scanned as the DELL drop folder.

Labeled SAMPLE fixtures live in `research/examples/` and are **not** auto-loaded. Copy one here only when you want a SAMPLE badge on the board.
