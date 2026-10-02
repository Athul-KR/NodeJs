/**
 * users.user_type values — stored as TINYINT (migration 004).
 * The ONE place these numbers are given names; everything else imports this.
 */
export const USER_TYPES = {
    ADMIN: 1,
    USER: 2,
    CUSTOMER: 3,
};

/** Human-readable labels for user_type, keyed by the numeric value. */
export const USER_TYPE_NAMES = {
    [USER_TYPES.ADMIN]: 'Admin',
    [USER_TYPES.USER]: 'User',
    [USER_TYPES.CUSTOMER]: 'Customer',
};

/**
 * Types the PUBLIC /register endpoint may choose. Admin is intentionally
 * absent: admin accounts are never self-service — they are created by a
 * seeder or promoted by an existing admin.
 */
export const PUBLIC_USER_TYPES = [USER_TYPES.USER, USER_TYPES.CUSTOMER];

/** users.status values — stored as TINYINT (migration 005). */
export const USER_STATUS = {
    INACTIVE: 0,
    ACTIVE: 1,
};
