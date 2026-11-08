/**
 * Evaluates whether a student profile satisfies the configurable eligibility rules of a Job.
 *
 * @param {Object} jobEligibility - Job's configured eligibility object
 * @param {Object} studentData - Student academic & skill data
 * @returns {Object} { isEligible: boolean, reasons: string[], criteriaBreakdown: Object }
 */
export function evaluateJobEligibility(jobEligibility = {}, studentData = {}) {
  const reasons = [];
  const criteriaBreakdown = {};

  // 1. CGPA check
  const minCgpa = Number(jobEligibility.minCgpa ?? 6.0);
  const studentCgpa = Number(studentData.btechCgpa ?? studentData.cgpa ?? 0);
  const cgpaPassed = studentCgpa >= minCgpa;
  criteriaBreakdown.cgpa = {
    required: minCgpa,
    actual: studentCgpa,
    passed: cgpaPassed,
  };
  if (!cgpaPassed) {
    reasons.push(`B.Tech CGPA (${studentCgpa}) is below required minimum of ${minCgpa}.`);
  }

  // 2. Allowed Branches check
  const allowedBranches = Array.isArray(jobEligibility.allowedBranches) && jobEligibility.allowedBranches.length > 0
    ? jobEligibility.allowedBranches
    : ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'MME'];
  const studentBranch = (studentData.branch || '').toUpperCase();
  const branchPassed = allowedBranches.includes(studentBranch);
  criteriaBreakdown.branch = {
    required: allowedBranches,
    actual: studentBranch,
    passed: branchPassed,
  };
  if (!branchPassed) {
    reasons.push(`Branch '${studentBranch || 'Unspecified'}' is not in allowed branches: ${allowedBranches.join(', ')}.`);
  }

  // 3. Batch Year check
  const eligibleBatchYears = Array.isArray(jobEligibility.eligibleBatchYears) && jobEligibility.eligibleBatchYears.length > 0
    ? jobEligibility.eligibleBatchYears.map(Number)
    : [2025, 2026];
  const studentBatch = Number(studentData.batchYear || studentData.graduationYear || 0);
  const batchPassed = studentBatch ? eligibleBatchYears.includes(studentBatch) : true;
  criteriaBreakdown.batchYear = {
    required: eligibleBatchYears,
    actual: studentBatch,
    passed: batchPassed,
  };
  if (!batchPassed) {
    reasons.push(`Graduation batch (${studentBatch}) is not in eligible batches: ${eligibleBatchYears.join(', ')}.`);
  }

  // 4. Active Backlogs check
  const maxActiveBacklogs = Number(jobEligibility.maxActiveBacklogs ?? 0);
  const studentActiveBacklogs = Number(studentData.activeBacklogs ?? 0);
  const activeBacklogsPassed = studentActiveBacklogs <= maxActiveBacklogs;
  criteriaBreakdown.activeBacklogs = {
    requiredMax: maxActiveBacklogs,
    actual: studentActiveBacklogs,
    passed: activeBacklogsPassed,
  };
  if (!activeBacklogsPassed) {
    reasons.push(`Active backlogs (${studentActiveBacklogs}) exceeds maximum allowed (${maxActiveBacklogs}).`);
  }

  // 5. Historical Backlogs check
  const maxHistoryBacklogs = Number(jobEligibility.maxHistoryBacklogs ?? 10);
  const studentHistoryBacklogs = Number(studentData.totalBacklogsHistory ?? studentData.backlogsHistory ?? studentActiveBacklogs);
  const historyBacklogsPassed = studentHistoryBacklogs <= maxHistoryBacklogs;
  criteriaBreakdown.historyBacklogs = {
    requiredMax: maxHistoryBacklogs,
    actual: studentHistoryBacklogs,
    passed: historyBacklogsPassed,
  };
  if (!historyBacklogsPassed) {
    reasons.push(`Total backlogs history (${studentHistoryBacklogs}) exceeds allowed (${maxHistoryBacklogs}).`);
  }

  // 6. Secondary / 10th standard percentage check
  const minTenth = Number(jobEligibility.minTenthPercentage ?? 0);
  if (minTenth > 0) {
    const studentTenth = Number(studentData.tenthPercentage ?? 100);
    const tenthPassed = studentTenth >= minTenth;
    criteriaBreakdown.tenthPercentage = {
      required: minTenth,
      actual: studentTenth,
      passed: tenthPassed,
    };
    if (!tenthPassed) {
      reasons.push(`10th percentage (${studentTenth}%) is below minimum required (${minTenth}%).`);
    }
  }

  // 7. Higher Secondary / PUC / Intermediate CGPA or Percentage check
  const minPuc = Number(jobEligibility.minTwelfthPucCgpa ?? 0);
  if (minPuc > 0) {
    const studentPuc = Number(studentData.pucCgpa ?? studentData.twelfthPercentage ?? 10);
    const pucPassed = studentPuc >= minPuc;
    criteriaBreakdown.pucCgpa = {
      required: minPuc,
      actual: studentPuc,
      passed: pucPassed,
    };
    if (!pucPassed) {
      reasons.push(`PUC / 12th score (${studentPuc}) is below minimum required (${minPuc}).`);
    }
  }

  // 8. Required Technical Skills check (if configured)
  const requiredSkills = Array.isArray(jobEligibility.requiredSkills)
    ? jobEligibility.requiredSkills.filter(Boolean)
    : [];
  if (requiredSkills.length > 0) {
    const studentSkills = Array.isArray(studentData.skills)
      ? studentData.skills.map((s) => (typeof s === 'string' ? s.toLowerCase() : (s.name || '').toLowerCase()))
      : [];
    const missingSkills = requiredSkills.filter(
      (reqSkill) => !studentSkills.some((s) => s.includes(reqSkill.toLowerCase()))
    );
    const skillsPassed = missingSkills.length === 0;
    criteriaBreakdown.skills = {
      required: requiredSkills,
      missing: missingSkills,
      passed: skillsPassed,
    };
    if (!skillsPassed) {
      reasons.push(`Missing mandatory technical skills: ${missingSkills.join(', ')}.`);
    }
  }

  const isEligible = reasons.length === 0;

  return {
    isEligible,
    reasons,
    criteriaBreakdown,
  };
}

