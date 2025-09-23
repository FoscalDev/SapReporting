const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const SapODataService = require('../services/sapODataService');
const EncryptionUtils = require('../utils/encryption');
const sapODataService = new SapODataService();

// Página para configurar credenciales SAP
router.get('/', requireAuth, (req, res) => {
    res.render('sap-credentials/index', {
        title: 'Configurar Credenciales SAP',
        user: req.user,
        session: req.session,
        error: req.flash('error'),
        success: req.flash('success'),
        hasCredentials: req.user.hasSapCredentials()
    });
});

// Procesar configuración de credenciales
router.post('/', requireAuth, async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        req.flash('error', 'Usuario y contraseña son requeridos');
        return res.redirect('/sap-credentials');
    }

    try {
        // Probar las credenciales con el servicio SAP
        const testResult = await sapODataService.testConnectionWithCredentials(username, password);
        
        if (testResult.success) {
            // Guardar credenciales encriptadas en la base de datos
            await req.user.updateSapCredentials(username, password);
            
            // Establecer contraseña temporal en la sesión de Express para uso inmediato
            req.session.sapTempPassword = password;
            
            req.flash('success', 'Credenciales SAP configuradas correctamente');
            res.redirect('/');
        } else {
            console.error('Error en prueba de conexión SAP (POST /):', testResult.error);
            req.flash('error', `Error al conectar con SAP: ${testResult.error}`);
            res.redirect('/sap-credentials');
        }
    } catch (error) {
        console.error('Error al configurar credenciales SAP:', error);
        req.flash('error', 'Error interno del servidor. Intenta nuevamente.');
        res.redirect('/sap-credentials');
    }
});

// Actualizar credenciales existentes
router.post('/update', requireAuth, async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        req.flash('error', 'Usuario y contraseña son requeridos');
        return res.redirect('/sap-credentials');
    }

    try {
        // Probar las nuevas credenciales
        const testResult = await sapODataService.testConnectionWithCredentials(username, password);
        
        if (testResult.success) {
            // Guardar credenciales encriptadas
            await req.user.updateSapCredentials(username, password);
            
            // Establecer contraseña temporal en la sesión de Express para uso inmediato
            req.session.sapTempPassword = password;
            
            req.flash('success', 'Credenciales SAP actualizadas correctamente');
            res.redirect('/');
        } else {
            console.error('Error en prueba de conexión SAP (POST /update):', testResult.error);
            req.flash('error', `Error al conectar con SAP: ${testResult.error}`);
            res.redirect('/sap-credentials');
        }
    } catch (error) {
        console.error('Error al actualizar credenciales SAP:', error);
        req.flash('error', 'Error interno del servidor. Intenta nuevamente.');
        res.redirect('/sap-credentials');
    }
});

// Reautenticar con credenciales SAP (para renovar sesión temporal)
router.post('/reauth', requireAuth, async (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        req.flash('error', 'Contraseña requerida para reautenticación');
        return res.redirect('/sap-credentials');
    }

    try {
        // Verificar que el usuario tenga credenciales configuradas
        if (!req.user.hasSapCredentials()) {
            req.flash('error', 'No tienes credenciales SAP configuradas');
            return res.redirect('/sap-credentials');
        }

        // Verificar la contraseña
        const credentials = req.user.getSapCredentials();
        const isValidPassword = await EncryptionUtils.verifyPassword(password, credentials.encryptedPassword);
        
        if (!isValidPassword) {
            req.flash('error', 'Contraseña incorrecta');
            return res.redirect('/sap-credentials');
        }

        // Establecer contraseña temporal en la sesión de Express
        req.session.sapTempPassword = password;
        
        req.flash('success', 'Reautenticación exitosa. Credenciales SAP disponibles para la sesión.');
        res.redirect('/');
    } catch (error) {
        console.error('Error en reautenticación SAP:', error);
        req.flash('error', 'Error interno del servidor.');
        res.redirect('/sap-credentials');
    }
});

// Marcar credenciales como inválidas (para reintentar conexión)
router.post('/invalidate', requireAuth, async (req, res) => {
    try {
        await req.user.markCredentialsInvalid();
        // Limpiar contraseña temporal de la sesión de Express
        delete req.session.sapTempPassword;
        req.flash('info', 'Credenciales marcadas como inválidas. Por favor, configúralas nuevamente.');
        res.redirect('/sap-credentials');
    } catch (error) {
        console.error('Error al marcar credenciales como inválidas:', error);
        req.flash('error', 'Error interno del servidor.');
        res.redirect('/');
    }
});

module.exports = router;
