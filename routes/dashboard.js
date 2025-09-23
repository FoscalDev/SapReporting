const express = require('express');
const { requireAuth, requireSapCredentials } = require('../middleware/auth');
const router = express.Router();

/**
 * Página principal (Dashboard) de la aplicación
 */
router.get('/', requireAuth, (req, res) => {
    try {
        res.render('dashboard', {
            title: 'Dashboard - SAP Reports',
            breadcrumb: 'Dashboard',
            currentPage: 'dashboard',
            user: req.user
        });
    } catch (error) {
        console.error('Error en el dashboard:', error);
        req.flash('error', 'Error al cargar el dashboard.');
        res.redirect('/login');
    }
});

module.exports = router;
