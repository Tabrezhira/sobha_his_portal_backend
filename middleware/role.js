export default function (requiredRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
};
