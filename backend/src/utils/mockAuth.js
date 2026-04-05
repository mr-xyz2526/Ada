function mockAuth(req, res, next) {
  const role = (req.headers['x-role'] || 'mentor').toLowerCase();
  const userId = Number(req.headers['x-user-id'] || 1);

  if (!['mentor', 'admin'].includes(role)) {
    return res.status(403).json({ message: 'Invalid role header. Use mentor or admin.' });
  }

  req.user = { role, id: userId };
  return next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  return next();
}

module.exports = { mockAuth, requireAdmin };
