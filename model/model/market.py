from model.predict import Outcome


def implied_probs(home_odds: float, draw_odds: float, away_odds: float) -> Outcome:
    raw = [1.0 / home_odds, 1.0 / draw_odds, 1.0 / away_odds]
    s = sum(raw)
    return Outcome(home=raw[0] / s, draw=raw[1] / s, away=raw[2] / s)


def blend(model_o: Outcome, market_o: Outcome | None, kappa: float = 0.35) -> Outcome:
    if market_o is None:
        return model_o
    return Outcome(
        home=(1 - kappa) * model_o.home + kappa * market_o.home,
        draw=(1 - kappa) * model_o.draw + kappa * market_o.draw,
        away=(1 - kappa) * model_o.away + kappa * market_o.away,
    )
