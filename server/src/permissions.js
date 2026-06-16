// Role hierarchy and permission helpers for servers.
const ROLE_RANK = { OWNER: 4, ADMIN: 3, MODERATOR: 2, MEMBER: 1 };

function rank(role) {
  return ROLE_RANK[role] || 0;
}

// Can the actor moderate the target? Actor must outrank target and be at least MOD.
function canModerate(actorRole, targetRole) {
  return rank(actorRole) >= ROLE_RANK.MODERATOR && rank(actorRole) > rank(targetRole);
}

function isAdmin(role) {
  return rank(role) >= ROLE_RANK.ADMIN;
}

module.exports = { ROLE_RANK, rank, canModerate, isAdmin };
