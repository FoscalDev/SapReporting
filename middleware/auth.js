// Middleware para verificar si el usuario está autenticado
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Debes iniciar sesión para acceder a esta página');
    res.redirect('/login');
};

// Middleware para verificar si el usuario tiene credenciales SAP configuradas
const requireSapCredentials = async (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }

    if (!req.user.hasSapCredentials()) {
        req.flash('error', 'Necesitas configurar tus credenciales SAP para acceder a los reportes');
        return res.redirect('/sap-credentials');
    }

    // Verificar si las credenciales son válidas
    if (!req.user.sapCredentials.isValid) {
        req.flash('error', 'Tus credenciales SAP han expirado. Por favor, configúralas nuevamente');
        return res.redirect('/sap-credentials');
    }

    next();
};

// Middleware para verificar si las credenciales SAP están disponibles en sesión
const requireSapSessionCredentials = async (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }

    if (!req.user.hasSapCredentials()) {
        req.flash('error', 'Necesitas configurar tus credenciales SAP para acceder a los reportes');
        return res.redirect('/sap-credentials');
    }

    // Verificar si las credenciales son válidas
    if (!req.user.sapCredentials.isValid) {
        req.flash('error', 'Tus credenciales SAP han expirado. Por favor, configúralas nuevamente');
        return res.redirect('/sap-credentials');
    }

    // Verificar si las credenciales están disponibles en la sesión de Express
    if (!req.session.sapTempPassword) {
        req.flash('error', 'Tu sesión SAP ha expirado. Por favor, reautentica tus credenciales para continuar.');
        return res.redirect('/sap-credentials');
    }

    next();
};

// Middleware para usuarios no autenticados (redirect si ya están logueados)
const requireGuest = (req, res, next) => {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    next();
};

module.exports = {
    requireAuth,
    requireSapCredentials,
    requireSapSessionCredentials,
    requireGuest
};
