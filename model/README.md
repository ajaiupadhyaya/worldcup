# Floodlit Prediction Model

Offline engine: ingest history + live ESPN → Elo-seeded Dixon-Coles ratings →
Monte-Carlo 2026 tournament sim → backtest → JSON snapshots in `../data/`.

Run: `uv run python -m model.run --seed 42 --sims 10000`
Test: `uv run pytest`
