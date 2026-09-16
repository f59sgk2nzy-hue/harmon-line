const BETTING_RE =
  /\b(ats|against the spread|cover(?:s|ed|ing)?(?:\s+the)?\s+spread|the spread|moneyline|\bml\b|over\/?under|o\/u|parlay|teaser|pick'?em|odds|vig|juice|polymarket|pickcenter|winprob|win probability|should i bet|wager|best bet|unit bet|paid odds)\b/i;

export function isBettingQuestion(q: string): boolean {
  return BETTING_RE.test(q);
}
