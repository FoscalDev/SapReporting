const express = require('express');
const router = express.Router();
const passport = require('passport');

// Página de login
router.get('/login', (req, res) => {
    res.render('auth/login', {
        title: 'Iniciar Sesión',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// Iniciar autenticación con Google
router.get('/auth/google', 
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
);

// Callback de Google OAuth
router.get('/auth/google/callback',
    passport.authenticate('google', { 
        failureRedirect: '/login',
        failureFlash: true 
    }),
    (req, res) => {
        // Si el usuario no tiene credenciales SAP, redirigir a configurarlas
        if (!req.user.hasSapCredentials()) {
            req.flash('info', '¡Bienvenido! Por favor, configura tus credenciales SAP.');
            return res.redirect('/sap-credentials');
        }
        
        req.flash('success', '¡Bienvenido! Has iniciado sesión correctamente');
        res.redirect('/');
    }
);

// Logout (GET y POST)
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
        }
        req.flash('success', 'Has cerrado sesión correctamente');
        res.redirect('/login');
    });
});

router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
        }
        req.flash('success', 'Has cerrado sesión correctamente');
        res.redirect('/login');
    });
});

module.exports = router;