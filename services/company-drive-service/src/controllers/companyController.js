import Company from '../models/Company.js';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001';
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

// ─── Helper ─────────────────────────────────────────────────────────────────

function getUserId(user) {
  return String(user?.userId || user?.id || user?._id || '');
}

async function findCompanyForManager(userId) {
  return Company.findOne({
    $or: [
      { registeredBy: userId },
      { recruiters: { $elemMatch: { userId, role: 'PRIMARY', status: 'ACTIVE' } } },
    ],
  });
}

async function findCompanyForMember(userId) {
  return Company.findOne({
    $or: [
      { registeredBy: userId },
      { recruiters: { $elemMatch: { userId, status: 'ACTIVE' } } },
    ],
  });
}

async function findAuthenticatedRecruiter(email) {
  if (!SERVICE_API_KEY) {
    const error = new Error('SERVICE_API_KEY is not configured for recruiter account verification.');
    error.code = 'SERVICE_CONFIGURATION_ERROR';
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(
    `${AUTH_SERVICE_URL}/api/v1/auth/internal/recruiters/${encodeURIComponent(email)}`,
    { headers: { 'x-service-key': SERVICE_API_KEY } }
  );
  const result = await response.json();
  if (!response.ok || !result.success || !result.data?.user) {
    const error = new Error(result.error?.message || 'Unable to verify the recruiter account.');
    error.code = result.error?.code || 'AUTH_SERVICE_ERROR';
    error.statusCode = response.status || 502;
    throw error;
  }
  return result.data.user;
}

function buildSearchQuery({ q, industry, verificationStatus, city, state, isActive }) {
  const query = {};

  if (q) {
    // Use MongoDB text search when available; fallback to regex
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ];
  }

  if (industry) query.industry = industry;
  if (verificationStatus) query.verificationStatus = verificationStatus;
  if (city) query['location.city'] = { $regex: city, $options: 'i' };
  if (state) query['location.state'] = { $regex: state, $options: 'i' };
  if (isActive !== undefined) query.isActive = isActive === 'true' || isActive === true;

  return query;
}

// ─── Controllers ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/drives
 * Register a new company. Only RECRUITER role.
 * One recruiter can only register one company.
 */
export async function registerCompany(req, res) {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;

    // Prevent duplicate registration by same recruiter
    const existing = await findCompanyForMember(userId);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'COMPANY_ALREADY_REGISTERED',
          message:
            'You are already associated with a company. Ask its primary recruiter to manage the company profile.',
        },
      });
    }

    const {
      name,
      industry,
      description,
      websiteUrl,
      logoUrl,
      location,
      contactEmail,
      contactPhone,
      hrName,
      linkedinUrl,
      glassdoorUrl,
    } = req.body;

    // Duplicate name check
    const nameConflict = await Company.findOne({ name: name?.trim() });
    if (nameConflict) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'COMPANY_NAME_TAKEN',
          message: 'A company with this name is already registered.',
        },
      });
    }

    const recruiterEntry = {
      userId,
      fullName: req.user.fullName || req.user.name || 'Recruiter',
      email: req.user.email || contactEmail,
      role: 'PRIMARY',
    };

    const company = new Company({
      name: name.trim(),
      industry,
      description: description || '',
      websiteUrl: websiteUrl || '',
      logoUrl: logoUrl || '',
      location: location || {},
      contactEmail,
      contactPhone: contactPhone || '',
      hrName: hrName || '',
      linkedinUrl: linkedinUrl || '',
      glassdoorUrl: glassdoorUrl || '',
      registeredBy: userId,
      recruiters: [recruiterEntry],
    });

    await company.save();

    return res.status(201).json({
      success: true,
      message: 'Company registered successfully. Awaiting admin verification.',
      data: { company },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: { code: 'COMPANY_NAME_TAKEN', message: 'A company with this name already exists.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/drives/my
 * Get the company associated with the authenticated recruiter.
 */
export async function getOwnCompany(req, res) {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const company = await findCompanyForMember(userId);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: 'You have not registered a company yet.',
        },
      });
    }

    return res.status(200).json({ success: true, data: { company } });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PUT /api/v1/drives/my
 * Update the recruiter's own company profile.
 * If a critical field is changed on a VERIFIED company → reset to PENDING.
 */
export async function updateCompany(req, res) {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const company = await Company.findOne({ registeredBy: userId });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'No company found for your account.' },
      });
    }

    const allowedFields = [
      'name',
      'industry',
      'description',
      'websiteUrl',
      'logoUrl',
      'location',
      'contactEmail',
      'contactPhone',
      'hrName',
      'linkedinUrl',
      'glassdoorUrl',
    ];

    const criticalFields = ['name', 'industry', 'contactEmail'];
    let criticalChanged = false;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (criticalFields.includes(field) && company[field] !== req.body[field]) {
          criticalChanged = true;
        }
        company[field] = req.body[field];
      }
    }

    // Reset verification if critical fields changed on a verified company
    if (criticalChanged && company.verificationStatus === 'VERIFIED') {
      company.verificationStatus = 'PENDING';
      company.verifiedBy = null;
      company.verifiedAt = null;
      company.verificationNotes = 'Re-verification required after profile changes.';
    }

    await company.save();

    return res.status(200).json({
      success: true,
      message: criticalChanged
        ? 'Company updated. Verification reset to PENDING due to critical field changes.'
        : 'Company profile updated successfully.',
      data: { company },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: { code: 'COMPANY_NAME_TAKEN', message: 'A company with this name already exists.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/drives
 * List all companies with pagination and filters.
 * Accessible by ADMIN, RECRUITER, STUDENT.
 */
export async function getAllCompanies(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      q,
      industry,
      verificationStatus,
      city,
      state,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Students only see VERIFIED companies
    let statusFilter = verificationStatus;
    if (req.user?.role === 'STUDENT') {
      statusFilter = 'VERIFIED';
    }

    const query = buildSearchQuery({ q, industry, verificationStatus: statusFilter, city, state, isActive });

    const sortField = ['name', 'createdAt', 'industry', 'placementDriveCount'].includes(sortBy)
      ? sortBy
      : 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const [companies, total] = await Promise.all([
      Company.find(query)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Company.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        companies,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/drives/search
 * Search companies with text and filter options.
 */
export async function searchCompanies(req, res) {
  try {
    const {
      q,
      industry,
      verificationStatus,
      city,
      state,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    let statusFilter = verificationStatus;
    if (req.user?.role === 'STUDENT') {
      statusFilter = 'VERIFIED';
    }

    const query = buildSearchQuery({ q, industry, verificationStatus: statusFilter, city, state });

    const [companies, total] = await Promise.all([
      Company.find(query).sort({ name: 1 }).skip(skip).limit(limitNum).lean(),
      Company.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        companies,
        query: { q, industry, verificationStatus: statusFilter, city, state },
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/drives/:id
 * Get a single company by ID.
 */
export async function getCompanyById(req, res) {
  try {
    const company = await Company.findById(req.params.id).lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'Company not found.' },
      });
    }

    // Students only see VERIFIED companies
    if (req.user?.role === 'STUDENT' && company.verificationStatus !== 'VERIFIED') {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'Company not found.' },
      });
    }

    return res.status(200).json({ success: true, data: { company } });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid company ID.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/drives/:id/verify
 * Admin verifies or rejects a company.
 */
export async function verifyCompany(req, res) {
  try {
    const { status, notes } = req.body;
    const adminId = req.user.userId || req.user.id || req.user._id;

    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'Company not found.' },
      });
    }

    company.verificationStatus = status;
    company.verifiedBy = adminId;
    company.verifiedAt = new Date();
    company.verificationNotes = notes || '';

    await company.save();

    return res.status(200).json({
      success: true,
      message: `Company ${status === 'VERIFIED' ? 'verified' : 'rejected'} successfully.`,
      data: { company },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid company ID.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * Helper to add a recruiter entry to a company document.
 */
async function attachRecruiterToCompany(company, recruiter, recruiterData) {
  const {
    designation,
    phone,
    canManageJobs = false,
    canManageRecruitment = false,
  } = recruiterData;
  const cleanEmail = recruiter.email.toLowerCase().trim();

  const duplicate = company.recruiters.some(
    (r) => r.userId === recruiter.id || (r.email && r.email.toLowerCase() === cleanEmail)
  );
  if (duplicate) {
    const error = new Error('A recruiter with this work email is already added to this company.');
    error.code = 'RECRUITER_ALREADY_EXISTS';
    error.statusCode = 409;
    throw error;
  }

  const newEntry = {
    userId: recruiter.id,
    fullName: recruiter.fullName,
    email: cleanEmail,
    designation: designation ? designation.trim() : 'Recruiter',
    phone: phone ? phone.trim() : '',
    role: 'SECONDARY',
    canManageJobs: Boolean(canManageJobs),
    canManageRecruitment: Boolean(canManageRecruitment),
    status: 'ACTIVE',
    addedAt: new Date(),
  };

  company.recruiters.push(newEntry);
  await company.save();

  return { company, addedRecruiter: newEntry };
}

/**
 * POST /api/v1/drives/my/recruiters
 * Recruiter adds a team recruiter to their company.
 */
export async function addOwnCompanyRecruiter(req, res) {
  try {
    const userId = getUserId(req.user);
    const company = await findCompanyForManager(userId);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'You have not registered a company yet.' },
      });
    }

    const recruiter = await findAuthenticatedRecruiter(String(req.body.email || '').trim().toLowerCase());
    if (recruiter.id === userId) {
      return res.status(409).json({
        success: false,
        error: { code: 'RECRUITER_ALREADY_EXISTS', message: 'You are already a member of this company.' },
      });
    }

    const existingCompany = await Company.findOne({
      $or: [
        { registeredBy: recruiter.id },
        { 'recruiters.userId': recruiter.id },
      ],
    });
    if (existingCompany && existingCompany._id.toString() !== company._id.toString()) {
      return res.status(409).json({
        success: false,
        error: { code: 'RECRUITER_ALREADY_ASSIGNED', message: 'This recruiter is already assigned to another company.' },
      });
    }

    const result = await attachRecruiterToCompany(company, recruiter, req.body);

    return res.status(201).json({
      success: true,
      message: 'Recruiter added to company successfully.',
      data: {
        company: result.company,
        recruiter: result.addedRecruiter,
      },
    });
  } catch (err) {
    if (['RECRUITER_ALREADY_EXISTS', 'RECRUITER_ACCOUNT_NOT_FOUND', 'RECRUITER_ALREADY_ASSIGNED'].includes(err.code)) {
      return res.status(err.statusCode || 409).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/drives/my/recruiters
 * Recruiter lists all team recruiters in their company.
 */
export async function getOwnCompanyRecruiters(req, res) {
  try {
    const userId = getUserId(req.user);
    const company = await Company.findOne({
      $or: [
        { registeredBy: userId },
        { recruiters: { $elemMatch: { userId, status: 'ACTIVE' } } },
      ],
    }).lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'No company found for this recruiter.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        companyId: company._id,
        companyName: company.name,
        recruiters: company.recruiters || [],
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * DELETE /api/v1/drives/my/recruiters/:recruiterId
 * Recruiter removes a team recruiter from their company.
 */
export async function removeOwnCompanyRecruiter(req, res) {
  try {
    const userId = getUserId(req.user);
    const { recruiterId } = req.params;

    const company = await findCompanyForManager(userId);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'No company found for this recruiter.' },
      });
    }

    const target = company.recruiters.find(
      (r) => r._id?.toString() === recruiterId || r.userId === recruiterId || r.email === recruiterId
    );
    if (target?.role === 'PRIMARY') {
      return res.status(403).json({
        success: false,
        error: { code: 'PRIMARY_RECRUITER_PROTECTED', message: 'The primary company recruiter cannot be removed.' },
      });
    }

    const initialCount = company.recruiters.length;
    company.recruiters = company.recruiters.filter(
      (r) => r._id?.toString() !== recruiterId && r.userId !== recruiterId && r.email !== recruiterId
    );

    if (company.recruiters.length === initialCount) {
      return res.status(404).json({
        success: false,
        error: { code: 'RECRUITER_NOT_FOUND', message: 'Recruiter not found in this company.' },
      });
    }

    await company.save();

    return res.status(200).json({
      success: true,
      message: 'Recruiter removed from company.',
      data: { company },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/drives/my/recruiters/:recruiterId/status
 * Recruiter activates or deactivates a team recruiter.
 */
export async function toggleOwnCompanyRecruiterStatus(req, res) {
  try {
    const userId = getUserId(req.user);
    const { recruiterId } = req.params;
    const { status } = req.body;

    const company = await findCompanyForManager(userId);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'No company found for this recruiter.' },
      });
    }

    const recruiter = company.recruiters.find(
      (r) => r._id?.toString() === recruiterId || r.userId === recruiterId || r.email === recruiterId
    );

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        error: { code: 'RECRUITER_NOT_FOUND', message: 'Recruiter not found in this company.' },
      });
    }

    if (recruiter.role === 'PRIMARY') {
      return res.status(403).json({
        success: false,
        error: { code: 'PRIMARY_RECRUITER_PROTECTED', message: 'The primary company recruiter status cannot be changed.' },
      });
    }
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Recruiter status must be ACTIVE or INACTIVE.' },
      });
    }
    recruiter.status = status;
    await company.save();

    return res.status(200).json({
      success: true,
      message: `Recruiter status updated to ${recruiter.status}.`,
      data: { company, recruiter },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

export async function updateOwnRecruiterPermissions(req, res) {
  try {
    const userId = getUserId(req.user);
    const company = await findCompanyForManager(userId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'No managed company found for this recruiter.' },
      });
    }

    const recruiter = company.recruiters.find(
      (entry) => entry._id?.toString() === req.params.recruiterId ||
        entry.userId === req.params.recruiterId
    );
    if (!recruiter || recruiter.status !== 'ACTIVE') {
      return res.status(404).json({
        success: false,
        error: { code: 'RECRUITER_NOT_FOUND', message: 'Active recruiter not found in this company.' },
      });
    }
    if (recruiter.role === 'PRIMARY') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PERMISSION_TARGET', message: 'Primary recruiter permissions cannot be changed here.' },
      });
    }
    const permissionFields = ['canManageJobs', 'canManageRecruitment'];
    const providedFields = permissionFields.filter((field) => req.body[field] !== undefined);
    if (providedFields.length === 0 || providedFields.some((field) => typeof req.body[field] !== 'boolean')) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'At least one recruiter permission must be provided as a boolean.' },
      });
    }

    for (const field of providedFields) recruiter[field] = req.body[field];
    await company.save();
    return res.status(200).json({
      success: true,
      message: 'Recruiter permissions updated.',
      data: { recruiter },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}

/**
 * POST /api/v1/drives/:id/recruiters
 * Admin or authorized Company Member adds a recruiter to a company.
 */
export async function addRecruiter(req, res) {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'Company not found.' },
      });
    }

    // Company members with primary-management rights can only manage their own company.
    if (req.user.role !== 'ADMIN') {
      const managedCompany = await findCompanyForManager(getUserId(req.user));
      if (!managedCompany || managedCompany._id.toString() !== company._id.toString()) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not authorized to manage recruiters for this company.' },
        });
      }
    }

    const recruiter = await findAuthenticatedRecruiter(String(req.body.email || '').trim().toLowerCase());
    const existingCompany = await Company.findOne({
      $or: [
        { registeredBy: recruiter.id },
        { 'recruiters.userId': recruiter.id },
      ],
    });
    if (existingCompany && existingCompany._id.toString() !== company._id.toString()) {
      return res.status(409).json({
        success: false,
        error: { code: 'RECRUITER_ALREADY_ASSIGNED', message: 'This recruiter is already assigned to another company.' },
      });
    }

    const result = await attachRecruiterToCompany(company, recruiter, req.body);

    return res.status(200).json({
      success: true,
      message: 'Recruiter added to company.',
      data: {
        company: result.company,
        recruiter: result.addedRecruiter,
      },
    });
  } catch (err) {
    if (['RECRUITER_ALREADY_EXISTS', 'RECRUITER_ACCOUNT_NOT_FOUND', 'RECRUITER_ALREADY_ASSIGNED'].includes(err.code)) {
      return res.status(err.statusCode || 409).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid company ID.' },
      });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * DELETE /api/v1/drives/:id/recruiters/:recruiterId
 * Admin or authorized Company Member removes a recruiter from a company.
 */
export async function removeRecruiter(req, res) {
  try {
    const { recruiterId } = req.params;

    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'Company not found.' },
      });
    }

    if (req.user.role !== 'ADMIN') {
      const managedCompany = await findCompanyForManager(getUserId(req.user));
      if (!managedCompany || managedCompany._id.toString() !== company._id.toString()) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not authorized to manage recruiters for this company.' },
        });
      }
    }

    const target = company.recruiters.find(
      (r) => r._id?.toString() === recruiterId || r.userId === recruiterId || r.email === recruiterId
    );
    if (target?.role === 'PRIMARY' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'PRIMARY_RECRUITER_PROTECTED', message: 'The primary company recruiter cannot be removed.' },
      });
    }

    const initialCount = company.recruiters.length;
    company.recruiters = company.recruiters.filter(
      (r) => r._id?.toString() !== recruiterId && r.userId !== recruiterId && r.email !== recruiterId
    );

    if (company.recruiters.length === initialCount) {
      return res.status(404).json({
        success: false,
        error: { code: 'RECRUITER_NOT_FOUND', message: 'Recruiter not found in this company.' },
      });
    }

    await company.save();

    return res.status(200).json({
      success: true,
      message: 'Recruiter removed from company.',
      data: { company },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid company ID.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/drives/internal/:id
 * Internal service call: returns company data needed by other services.
 * Requires x-service-key header.
 */
export async function getInternalCompanyData(req, res) {
  try {
    const company = await Company.findById(req.params.id).lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'Company not found.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        companyId: company._id,
        name: company.name,
        industry: company.industry,
        verificationStatus: company.verificationStatus,
        isActive: company.isActive,
        placementDriveCount: company.placementDriveCount,
        location: company.location,
        contactEmail: company.contactEmail,
        recruiters: company.recruiters,
      },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid company ID.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}
