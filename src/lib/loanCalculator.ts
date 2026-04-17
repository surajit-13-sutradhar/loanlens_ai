// src/lib/loanCalculator.ts

export interface KYCData {
  // Section 1
  fullName?: string;
  dateOfBirth?: string;
  aadhaarOrPan?: string;
  currentAddress?: string;
  consentGiven?: boolean;
  // Section 2
  employmentType?: "Salaried" | "Self-Employed" | "Unemployed";
  employerOrBusiness?: string;
  workTenureYears?: number;
  monthlyNetIncome?: number;
  // Section 3
  hasExistingLoans?: boolean;
  totalMonthlyEmi?: number;
  usesCreditCards?: boolean;
  hasMissedEmi?: boolean;
  missedEmiCount?: number;
  lastMissedEmiMonthsAgo?: number | null;
  creditHistoryYears?: number;
  // Section 4
  loanAmountNeeded?: number;
  loanPurpose?: string;
  loanUrgencyDays?: number;
  preferredTenureMonths?: number;
}

export interface LoanOption {
  plan: "Safe" | "Balanced" | "Max";
  principalAmount: number;
  tenureMonths: number;
  annualInterestRate: number;
  monthlyEmi: number;
}

export interface LoanDecision {
  decision: "APPROVE" | "REVIEW" | "REJECT";
  proxyScore: number;
  foir: number;
  foirStatus: "safe" | "moderate" | "risky";
  ageEligible: boolean;
  maxAffordableEmi: number;
  rejectionReasons: string[];
  loanOptions: LoanOption[] | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse DD/MM/YYYY → age in years (floored) */
function calcAge(dob: string): number {
  const [day, month, year] = dob.split("/").map(Number);
  const birth = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasBirthdayPassed) age--;
  return age;
}

/** EMI = P × r(1+r)^n / ((1+r)^n − 1) */
function calcEmi(principal: number, annualRate: number, tenureMonths: number): number {
  const r = annualRate / 12 / 100;
  const powered = Math.pow(1 + r, tenureMonths);
  return Math.round((principal * r * powered) / (powered - 1));
}

/** Reverse: given max EMI, return max principal */
function maxPrincipalForEmi(
  maxEmi: number,
  annualRate: number,
  tenureMonths: number
): number {
  const r = annualRate / 12 / 100;
  const powered = Math.pow(1 + r, tenureMonths);
  return Math.floor((maxEmi * (powered - 1)) / (r * powered));
}

// ─── Score components ──────────────────────────────────────────────────────────

function paymentHistoryScore(
  hasMissedEmi: boolean,
  missedEmiCount: number,
  lastMissedEmiMonthsAgo: number | null
): number {
  if (!hasMissedEmi || missedEmiCount === 0) return 100;
  if (missedEmiCount >= 3) return 30;
  // 1–2 misses
  if (lastMissedEmiMonthsAgo !== null && lastMissedEmiMonthsAgo > 12) return 75;
  return 55;
}

function creditHistoryScore(creditHistoryYears: number): number {
  if (creditHistoryYears >= 5) return 100;
  if (creditHistoryYears >= 2) return 80;
  if (creditHistoryYears > 0) return 50;
  return 40;
}

function incomeStabilityScore(workTenureYears: number): number {
  if (workTenureYears >= 3) return 100;
  if (workTenureYears >= 1) return 75;
  return 50;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeLoanDecision(data: KYCData): LoanDecision {
  const {
    dateOfBirth = "",
    employmentType = "Unemployed",
    workTenureYears = 0,
    monthlyNetIncome = 0,
    totalMonthlyEmi = 0,
    hasMissedEmi = false,
    missedEmiCount = 0,
    lastMissedEmiMonthsAgo = null,
    creditHistoryYears = 0,
    loanAmountNeeded = 0,
    preferredTenureMonths = 24,
    consentGiven = false,
  } = data;

  const rejectionReasons: string[] = [];

  // ── 1. FOIR ──────────────────────────────────────────────────────────────────
  const foir = monthlyNetIncome > 0 ? totalMonthlyEmi / monthlyNetIncome : 1;

  const foirLimit =
    monthlyNetIncome < 25_000 ? 0.35 : monthlyNetIncome <= 50_000 ? 0.40 : 0.50;

  const foirStatus: "safe" | "moderate" | "risky" =
    foir < foirLimit
      ? "safe"
      : foir < foirLimit + 0.10
      ? "moderate"
      : "risky";

  if (foirStatus === "risky") {
    rejectionReasons.push("Debt-to-income ratio is too high (FOIR risky).");
  }

  // ── 2. Max affordable EMI ────────────────────────────────────────────────────
  const maxAffordableEmi = Math.max(
    0,
    Math.floor(foirLimit * monthlyNetIncome) - totalMonthlyEmi
  );

  // ── 3. Age eligibility ───────────────────────────────────────────────────────
  const age = dateOfBirth ? calcAge(dateOfBirth) : 0;
  const retirementAge = employmentType === "Salaried" ? 60 : 65;
  const ageEligible =
    age >= 18 && age + preferredTenureMonths / 12 <= retirementAge;

  if (!ageEligible) {
    rejectionReasons.push(
      age < 18
        ? "Applicant must be at least 18 years old."
        : "Loan tenure would exceed retirement age limit."
    );
  }

  // ── 4. Proxy credit score ────────────────────────────────────────────────────
  const phScore = paymentHistoryScore(hasMissedEmi, missedEmiCount, lastMissedEmiMonthsAgo);
  const chScore = creditHistoryScore(creditHistoryYears);
  const isScore = incomeStabilityScore(workTenureYears);

  const proxyScore = Math.round(
    phScore * 0.40 + chScore * 0.30 + isScore * 0.30
  );

  if (proxyScore < 55) {
    rejectionReasons.push("Credit profile score is below the minimum threshold.");
  }
  if (!consentGiven) {
    rejectionReasons.push("Consent for KYC verification was not provided.");
  }

  // ── 5. Decision ───────────────────────────────────────────────────────────────
  let decision: "APPROVE" | "REVIEW" | "REJECT";

  if (!ageEligible || foirStatus === "risky" || proxyScore < 55 || !consentGiven) {
    decision = "REJECT";
  } else if (proxyScore < 70 || foirStatus === "moderate") {
    decision = "REVIEW";
  } else {
    decision = "APPROVE";
  }

  // ── 6. Loan options (APPROVE or REVIEW only) ─────────────────────────────────
  let loanOptions: LoanOption[] | null = null;

  if (decision !== "REJECT" && maxAffordableEmi > 0) {
    const plans: { plan: LoanOption["plan"]; tenure: number; rate: number }[] = [
      { plan: "Safe",     tenure: 24, rate: 11.5 },
      { plan: "Balanced", tenure: 30, rate: 12.5 },
      { plan: "Max",      tenure: 36, rate: 13.5 },
    ];

    loanOptions = plans.map(({ plan, tenure, rate }) => {
      const maxPrincipal = maxPrincipalForEmi(maxAffordableEmi, rate, tenure);
      const principalAmount = Math.min(loanAmountNeeded, maxPrincipal);
      const monthlyEmi = calcEmi(principalAmount, rate, tenure);

      return {
        plan,
        principalAmount,
        tenureMonths: tenure,
        annualInterestRate: rate,
        monthlyEmi,
      };
    });
  }

  return {
    decision,
    proxyScore,
    foir: parseFloat(foir.toFixed(4)),
    foirStatus,
    ageEligible,
    maxAffordableEmi,
    rejectionReasons,
    loanOptions,
  };
}