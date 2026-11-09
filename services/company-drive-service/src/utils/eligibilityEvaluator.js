const BRANCH_ALIASES = new Map([
  ['CSE', 'CSE'],
  ['CS', 'CSE'],
  ['COMPUTER SCIENCE', 'CSE'],
  ['COMPUTER SCIENCE AND ENGINEERING', 'CSE'],
  ['ECE', 'ECE'],
  ['ELECTRONICS AND COMMUNICATIONS', 'ECE'],
  ['ELECTRONICS AND COMMUNICATION ENGINEERING', 'ECE'],
  ['EEE', 'EEE'],
  ['ELECTRICAL AND ELECTRONICS', 'EEE'],
  ['ELECTRICAL AND ELECTRONICS ENGINEERING', 'EEE'],
  ['MECH', 'MECH'],
  ['MECHANICAL', 'MECH'],
  ['MECHANICAL ENGINEERING', 'MECH'],
  ['CIVIL', 'CIVIL'],
  ['CIVIL ENGINEERING', 'CIVIL'],
  ['CHEM', 'CHEM'],
  ['CHEMICAL', 'CHEM'],
  ['CHEMICAL ENGINEERING', 'CHEM'],
  ['MME', 'MME'],
  ['METALLURGICAL AND MATERIALS ENGINEERING', 'MME'],
]);

function readNumber(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBranch(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ').toUpperCase();
  return BRANCH_ALIASES.get(normalized) || null;
}

function makeCriterion(required, actual, status, explanation) {
  return {
    required,
    actual,
    status,
    passed: status === 'PASS' ? true : status === 'FAIL' ? false : null,
    explanation,
  };
}

/**
 * Evaluate a canonical student profile against job or placement-drive criteria.
 * The caller must load student data from Student Service, never from a browser payload.
 */
export function evaluateJobEligibility(jobEligibility = {}, studentData = {}) {
  const criteria = {};
  const reasons = [];

  function addNumericCriterion(key, required, value, operator, label) {
    if (required === undefined || required === null) return;
    const actual = readNumber(value);
    if (actual === null) {
      const explanation = `${label} is missing or invalid; it is required to evaluate eligibility.`;
      criteria[key] = makeCriterion(required, value ?? null, 'INSUFFICIENT_DATA', explanation);
      reasons.push(explanation);
      return;
    }

    const threshold = readNumber(required);
    if (threshold === null) {
      const explanation = `The configured ${label.toLowerCase()} requirement is invalid.`;
      criteria[key] = makeCriterion(required, actual, 'INSUFFICIENT_DATA', explanation);
      reasons.push(explanation);
      return;
    }

    const passed = operator === 'min' ? actual >= threshold : actual <= threshold;
    const explanation = passed
      ? `${label} meets the configured requirement.`
      : operator === 'min'
        ? `${label} (${actual}) is below the required minimum of ${threshold}.`
        : `${label} (${actual}) exceeds the maximum allowed value of ${threshold}.`;
    criteria[key] = makeCriterion(required, actual, passed ? 'PASS' : 'FAIL', explanation);
    if (!passed) reasons.push(explanation);
  }

  if (jobEligibility.minCgpa !== undefined && jobEligibility.minCgpa !== null) {
    addNumericCriterion('cgpa', jobEligibility.minCgpa, studentData.btechCgpa, 'min', 'B.Tech CGPA');
  }

  const allowedBranches = Array.isArray(jobEligibility.allowedBranches)
    ? jobEligibility.allowedBranches.map(normalizeBranch).filter(Boolean)
    : [];
  if (allowedBranches.length > 0) {
    const actual = normalizeBranch(studentData.branch);
    if (!actual) {
      const explanation = 'Student branch is missing or is not a recognized RGUKT branch.';
      criteria.branch = makeCriterion(allowedBranches, studentData.branch ?? null, 'INSUFFICIENT_DATA', explanation);
      reasons.push(explanation);
    } else {
      const passed = allowedBranches.includes(actual);
      const explanation = passed
        ? `Branch ${actual} is eligible.`
        : `Branch ${actual} is not in the eligible branches: ${allowedBranches.join(', ')}.`;
      criteria.branch = makeCriterion(allowedBranches, actual, passed ? 'PASS' : 'FAIL', explanation);
      if (!passed) reasons.push(explanation);
    }
  }

  const eligibleBatchYears = Array.isArray(jobEligibility.eligibleBatchYears)
    ? jobEligibility.eligibleBatchYears.map(readNumber).filter((year) => year !== null)
    : [];
  if (eligibleBatchYears.length > 0) {
    const actual = readNumber(studentData.graduationYear ?? studentData.batchYear);
    if (actual === null) {
      const explanation = 'Graduation year is missing or invalid.';
      criteria.graduationYear = makeCriterion(eligibleBatchYears, studentData.graduationYear ?? studentData.batchYear ?? null, 'INSUFFICIENT_DATA', explanation);
      reasons.push(explanation);
    } else {
      const passed = eligibleBatchYears.includes(actual);
      const explanation = passed
        ? `Graduation year ${actual} is eligible.`
        : `Graduation year ${actual} is not in the eligible years: ${eligibleBatchYears.join(', ')}.`;
      criteria.graduationYear = makeCriterion(eligibleBatchYears, actual, passed ? 'PASS' : 'FAIL', explanation);
      if (!passed) reasons.push(explanation);
    }
  }

  addNumericCriterion(
    'activeBacklogs',
    jobEligibility.maxActiveBacklogs,
    studentData.activeBacklogs,
    'max',
    'Active backlogs'
  );
  addNumericCriterion(
    'historyBacklogs',
    jobEligibility.maxHistoryBacklogs,
    studentData.backlogHistory,
    'max',
    'Historical backlogs'
  );
  addNumericCriterion(
    'tenthPercentage',
    jobEligibility.minTenthPercentage > 0 ? jobEligibility.minTenthPercentage : undefined,
    studentData.tenthPercentage,
    'min',
    '10th percentage'
  );
  addNumericCriterion(
    'pucCgpa',
    (jobEligibility.minTwelfthPucCgpa ?? jobEligibility.minPucCgpa) > 0
      ? jobEligibility.minTwelfthPucCgpa ?? jobEligibility.minPucCgpa
      : undefined,
    studentData.pucCgpa,
    'min',
    'PUC CGPA'
  );

  const genderRequirement = jobEligibility.genderPreference;
  if (genderRequirement && genderRequirement !== 'All') {
    const requiredGender = genderRequirement.toUpperCase().startsWith('FEMALE') ? 'FEMALE' : 'MALE';
    const actualGender = typeof studentData.gender === 'string' ? studentData.gender.toUpperCase() : null;
    const status = !actualGender
      ? 'INSUFFICIENT_DATA'
      : actualGender === requiredGender
        ? 'PASS'
        : 'FAIL';
    const explanation = status === 'PASS'
      ? 'Gender meets the configured requirement.'
      : status === 'FAIL'
        ? `Gender does not meet the configured ${genderRequirement} requirement.`
        : 'Gender information is missing; it is required by this job.';
    criteria.gender = makeCriterion(genderRequirement, actualGender, status, explanation);
    if (status !== 'PASS') reasons.push(explanation);
  }

  const requiredSkills = Array.isArray(jobEligibility.requiredSkills)
    ? jobEligibility.requiredSkills.map((skill) => String(skill).trim()).filter(Boolean)
    : [];
  if (requiredSkills.length > 0) {
    const sourceSkills = [
      ...(Array.isArray(studentData.skills) ? studentData.skills : []),
      ...(Array.isArray(studentData.technicalSkills) ? studentData.technicalSkills : []),
      ...(Array.isArray(studentData.nonTechnicalSkills) ? studentData.nonTechnicalSkills : []),
    ];
    const actualSkills = sourceSkills
      .map((skill) => typeof skill === 'string' ? skill.trim().toLowerCase() : '')
      .filter(Boolean);
    const missingSkills = requiredSkills.filter(
      (required) => !actualSkills.some((actual) => actual.includes(required.toLowerCase()))
    );
    const status = sourceSkills.length === 0
      ? 'INSUFFICIENT_DATA'
      : missingSkills.length === 0
        ? 'PASS'
        : 'FAIL';
    const explanation = status === 'PASS'
      ? 'Student has all required skills.'
      : status === 'FAIL'
        ? `Missing required skills: ${missingSkills.join(', ')}.`
        : 'Student skills are missing; required skills cannot be verified.';
    criteria.skills = makeCriterion(requiredSkills, sourceSkills, status, explanation);
    if (status !== 'PASS') reasons.push(explanation);
  }

  const values = Object.values(criteria);
  const hasFailure = values.some((criterion) => criterion.status === 'FAIL');
  const hasInsufficientData = values.some((criterion) => criterion.status === 'INSUFFICIENT_DATA');
  const status = hasFailure ? 'NOT_ELIGIBLE' : hasInsufficientData ? 'INSUFFICIENT_DATA' : 'ELIGIBLE';

  return {
    status,
    eligible: status === 'ELIGIBLE' ? true : status === 'NOT_ELIGIBLE' ? false : null,
    isEligible: status === 'ELIGIBLE',
    criteria,
    criteriaBreakdown: criteria,
    reasons,
  };
}
