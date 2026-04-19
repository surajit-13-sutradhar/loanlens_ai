// ✅ Add this helper at the top — strips currency symbols and commas
function toNum(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  // strip ₹, commas, spaces then parse
  const cleaned = String(val).replace(/[₹,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function calculateLoanDecision(data: any) {
  // ✅ Use toNum() for every numeric field
  const income        = toNum(data.monthlyNetIncome);
  const existingEmi   = toNum(data.totalMonthlyEmi);
  const requestedAmount = toNum(data.loanAmountNeeded);
  const monthsAgo     = toNum(data.lastMissedEmiMonthsAgo) || 999;
  const isRecent      = monthsAgo <= 12;

  // FOIR
  const foirLimit   = income < 25000 ? 0.35 : income <= 50000 ? 0.40 : 0.50;
  const currentFoir = income > 0 ? existingEmi / income : 0;
  const foirStatus  =
    currentFoir < foirLimit            ? "safe"     :
    currentFoir < foirLimit + 0.1      ? "moderate" : "risky";
  const maxAffordableEmi = Math.max(0, foirLimit * income - existingEmi);

  // Proxy credit score
  const missedCount = toNum(data.missedEmiCount);
  const payScore = data.hasMissedEmi
    ? missedCount >= 3
      ? isRecent ? 20 : 45
      : isRecent ? 50 : 70
    : 100;

  const creditAgeScore =
    toNum(data.creditHistoryYears) >= 5 ? 100 :
    toNum(data.creditHistoryYears) >= 2 ? 80  : 50;

  const stabilityScore = toNum(data.workTenureYears) >= 3 ? 100 : 60;

  const proxyScore =
    payScore      * 0.40 +
    creditAgeScore * 0.30 +
    stabilityScore * 0.30;

  // Decision
  let decision: "APPROVE" | "REVIEW" | "REJECT" = "APPROVE";
  const reasons: string[] = [];

  if (foirStatus === "risky") {
    decision = "REJECT";
    reasons.push("Debt burden too high (FOIR exceeds limit)");
  }
  if (proxyScore < 55) {
    decision = "REJECT";
    reasons.push("Credit confidence below minimum threshold");
  }
  if (decision !== "REJECT" && (proxyScore < 70 || foirStatus === "moderate")) {
    decision = "REVIEW";
  }

  const loanOptions =
    decision !== "REJECT"
      ? [
          generateEMI(requestedAmount, 24, 11.5, "Safe"),
          generateEMI(requestedAmount, 30, 12.5, "Balanced"),
          generateEMI(requestedAmount, 36, 13.5, "Max"),
        ]
      : null;

  return {
    decision,
    proxyScore:       Math.round(proxyScore),
    foir:             parseFloat((currentFoir * 100).toFixed(1)), // e.g. 38.5
    foirStatus,
    maxAffordableEmi: Math.round(maxAffordableEmi),
    rejectionReasons: reasons,
    loanOptions,
  };
}

function generateEMI(
  P: number,
  n: number,
  rate: number,
  plan: "Safe" | "Balanced" | "Max"
) {
  const r = rate / 12 / 100;
  const emi = Math.round(
    (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  );
  return { plan, principalAmount: P, tenureMonths: n, annualInterestRate: rate, monthlyEmi: emi };
}