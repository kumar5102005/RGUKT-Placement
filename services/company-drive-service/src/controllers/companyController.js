import Company from '../models/Company.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

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
    const existing = await Company.findOne({ registeredBy: userId });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'COMPANY_ALREADY_REGISTERED',
          message:
            'You have already registered a company. Update your existing company profile instead.',
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
 * Get the company registered by the authenticated recruiter.
 */
export async function getOwnCompany(req, res) {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const company = await Company.findOne({ registeredBy: userId });

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
 * POST /api/v1/drives/:id/recruiters
 * Admin adds a recruiter to a company.
 */
export async function addRecruiter(req, res) {
  try {
    const { userId, fullName, email, role } = req.body;

    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'Company not found.' },
      });
    }

    // Check if recruiter already associated
    const alreadyLinked = company.recruiters.some((r) => r.userId === userId);
    if (alreadyLinked) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'RECRUITER_ALREADY_LINKED',
          message: 'This recruiter is already linked to the company.',
        },
      });
    }

    company.recruiters.push({ userId, fullName, email, role: role || 'SECONDARY' });
    await company.save();

    return res.status(200).json({
      success: true,
      message: 'Recruiter added to company.',
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
 * DELETE /api/v1/drives/:id/recruiters/:recruiterId
 * Admin removes a recruiter from a company.
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

    const initialCount = company.recruiters.length;
    company.recruiters = company.recruiters.filter((r) => r.userId !== recruiterId);

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

