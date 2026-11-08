/**
 * Calculate student profile completion percentage (0 to 100)
 */
export function calculateProfileCompletion(profile) {
  let score = 0;

  // 1. Personal Information (20%)
  if (profile.fullName && profile.fullName.trim().length > 0) score += 5;
  if (profile.email && profile.email.trim().length > 0) score += 5;
  if (profile.phone && profile.phone.trim().length > 0) score += 5;
  if (profile.gender && profile.gender !== "PREFER_NOT_TO_SAY") score += 2.5;
  if (profile.dateOfBirth) score += 2.5;

  // 2. Academic Records (25%)
  if (profile.branch) score += 5;
  if (profile.batchYear) score += 5;
  if (profile.tenthPercentage && profile.tenthPercentage > 0) score += 5;
  if (profile.pucCgpa && profile.pucCgpa > 0) score += 5;
  if (profile.btechCgpa && profile.btechCgpa > 0) score += 5;

  // 3. Semester Breakdown (10%)
  if (Array.isArray(profile.semesters) && profile.semesters.length > 0) {
    score += 10;
  }

  // 4. Skills (15%)
  if (Array.isArray(profile.technicalSkills) && profile.technicalSkills.length >= 2) {
    score += 10;
  } else if (Array.isArray(profile.technicalSkills) && profile.technicalSkills.length > 0) {
    score += 5;
  }

  if (Array.isArray(profile.nonTechnicalSkills) && profile.nonTechnicalSkills.length >= 1) {
    score += 5;
  }

  // 5. Projects & Professional Links (15%)
  if (Array.isArray(profile.projects) && profile.projects.length >= 1) {
    score += 10;
  }
  if (profile.linkedinUrl || profile.githubUrl || profile.portfolioUrl) {
    score += 5;
  }

  // 6. Resume Uploaded (15%)
  if (profile.resumeUrl && profile.resumeUrl.trim().length > 0) {
    score += 15;
  }

  return Math.min(100, Math.round(score));
}

