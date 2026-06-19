/**
 * Respuestas UniSat mockeadas para tests. Deterministas, sin red.
 */

export interface UnisatEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

export interface UnisatBrc20BalanceData {
  ticker: string;
  overallBalance: string;
  availableBalance: string;
  transferableBalance: string;
}

export const fixtureBrc20BalanceWithTokens: UnisatEnvelope<UnisatBrc20BalanceData> = {
  code: 0,
  msg: "ok",
  data: {
    ticker: "Moonyetis",
    overallBalance: "1000",
    availableBalance: "950",
    transferableBalance: "50",
  },
};

export const fixtureBrc20BalanceZero: UnisatEnvelope<UnisatBrc20BalanceData> = {
  code: 0,
  msg: "ok",
  data: {
    ticker: "Moonyetis",
    overallBalance: "0",
    availableBalance: "0",
    transferableBalance: "0",
  },
};

export const fixtureApiError: UnisatEnvelope<null> = {
  code: 10001,
  msg: "Invalid address format",
  data: null,
};
