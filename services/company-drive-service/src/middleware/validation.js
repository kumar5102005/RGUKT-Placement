/**
 * Validation middleware for Company routes.
 */

const INDUSTRIES = [
  'IT Services',
  'Software Product',
  'Core Engineering',
  'Banking & Finance',
  'Consulting',
  'Healthcare',
  'E-Commerce',
  'Manufacturing',
  'Telecommunications',
  'Education & Ed-Tech',
  'Government & PSU',
  'Research & Development',
  'Other',
];

function sendValidationError(res, details) {
  return res.status(422).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details,
    },
  });
}

function isValidUrl(str) {
  if (!str) return true; // optional fields
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  if (!phone) return true; // optional
  return /^[\d\s\-\+\(\)]{7,20}$/.test(phone);
}

/**
 * Validate company registration payload.
 */
export function validateCompanyRegistration(req, res, next) {
  const errors = [];
  const { name, industry, contactEmail, contactPhone, websiteUrl, linkedinUrl, glassdoorUrl } =
    req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Company name must be at least 2 characters' });
  }
  if (name && name.trim().length > 150) {
    errors.push({ field: 'name', message: 'Company name must not exceed 150 characters' });
  }

  if (!industry || !INDUSTRIES.includes(industry)) {
    errors.push({
      field: 'industry',
      message: `Industry must be one of: ${INDUSTRIES.join(', ')}`,
    });
  }

  if (!contactEmail || !isValidEmail(contactEmail)) {
    errors.push({ field: 'contactEmail', message: 'A valid contact email is required' });
  }

  if (contactPhone && !isValidPhone(contactPhone)) {
    errors.push({ field: 'contactPhone', message: 'Invalid phone number format' });
  }

  if (websiteUrl && !isValidUrl(websiteUrl)) {
    errors.push({ field: 'websiteUrl', message: 'Invalid website URL' });
  }

  if (linkedinUrl && !isValidUrl(linkedinUrl)) {
    errors.push({ field: 'linkedinUrl', message: 'Invalid LinkedIn URL' });
  }

  if (glassdoorUrl && !isValidUrl(glassdoorUrl)) {
    errors.push({ field: 'glassdoorUrl', message: 'Invalid Glassdoor URL' });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validate company update payload (partial updates allowed).
 */
export function validateCompanyUpdate(req, res, next) {
  const errors = [];
  const { name, industry, contactEmail, contactPhone, websiteUrl, linkedinUrl, glassdoorUrl } =
    req.body;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Company name must be at least 2 characters' });
    }
    if (name.trim().length > 150) {
      errors.push({ field: 'name', message: 'Company name must not exceed 150 characters' });
    }
  }

  if (industry !== undefined && !INDUSTRIES.includes(industry)) {
    errors.push({
      field: 'industry',
      message: `Industry must be one of: ${INDUSTRIES.join(', ')}`,
    });
  }

  if (contactEmail !== undefined && !isValidEmail(contactEmail)) {
    errors.push({ field: 'contactEmail', message: 'A valid contact email is required' });
  }

  if (contactPhone && !isValidPhone(contactPhone)) {
    errors.push({ field: 'contactPhone', message: 'Invalid phone number format' });
  }

  if (websiteUrl && !isValidUrl(websiteUrl)) {
    errors.push({ field: 'websiteUrl', message: 'Invalid website URL' });
  }

  if (linkedinUrl && !isValidUrl(linkedinUrl)) {
    errors.push({ field: 'linkedinUrl', message: 'Invalid LinkedIn URL' });
  }

  if (glassdoorUrl && !isValidUrl(glassdoorUrl)) {
    errors.push({ field: 'glassdoorUrl', message: 'Invalid Glassdoor URL' });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validate company verification payload.
 */
export function validateVerification(req, res, next) {
  const errors = [];
  const { status, notes } = req.body;

  const allowedStatuses = ['VERIFIED', 'REJECTED'];
  if (!status || !allowedStatuses.includes(status)) {
    errors.push({
      field: 'status',
      message: `Status must be one of: ${allowedStatuses.join(', ')}`,
    });
  }

  if (notes && typeof notes === 'string' && notes.length > 500) {
    errors.push({ field: 'notes', message: 'Notes must not exceed 500 characters' });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validate add recruiter payload.
 */
export function validateAddRecruiter(req, res, next) {
  const errors = [];
  const { fullName, email, role } = req.body;

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    errors.push({ field: 'fullName', message: 'Recruiter full name must be at least 2 characters' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'A valid recruiter work email is required' });
  }

  if (role !== undefined && !['PRIMARY', 'SECONDARY'].includes(role)) {
    errors.push({ field: 'role', message: 'Role must be PRIMARY or SECONDARY' });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

