// Role hierarchy: run_manager > editor > viewer
const ROLE_LEVEL = { viewer: 1, editor: 2, run_manager: 3 };

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    const minLevel = Math.min(...allowedRoles.map(r => ROLE_LEVEL[r] || 0));

    if (userLevel < minLevel) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = authorize;
