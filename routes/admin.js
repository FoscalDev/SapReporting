const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Middleware para verificar si el usuario es administrador
const requireAdmin = async (req, res, next) => {
    try {
        // Por ahora, cualquier usuario autenticado puede ser admin
        // En el futuro se puede agregar un campo 'role' al modelo User
        if (!req.isAuthenticated()) {
            req.flash('error', 'Debes iniciar sesión para acceder a esta sección.');
            return res.redirect('/login');
        }
        
        // Aquí se puede agregar lógica adicional para verificar roles de administrador
        // Por ejemplo: if (req.user.role !== 'admin') { ... }
        
        next();
    } catch (error) {
        console.error('Error en middleware requireAdmin:', error);
        req.flash('error', 'Error de autorización.');
        res.redirect('/login');
    }
};

// Página principal de administración de usuarios
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Obtener todos los usuarios con paginación
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const users = await User.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const totalUsers = await User.countDocuments();
        const totalPages = Math.ceil(totalUsers / limit);
        
        res.render('admin/users', {
            title: 'Gestión de Usuarios',
            breadcrumb: 'Administración > Usuarios',
            currentPage: 'admin-users',
            users: users,
            user: req.user,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalUsers: totalUsers,
                limit: limit,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            }
        });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        req.flash('error', 'Error al cargar la lista de usuarios.');
        res.redirect('/');
    }
});

// Vista detallada de un usuario específico
router.get('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        
        if (!user) {
            req.flash('error', 'Usuario no encontrado.');
            return res.redirect('/admin/users');
        }
        
        res.render('admin/user-detail', {
            title: `Detalle de Usuario: ${user.name}`,
            breadcrumb: 'Administración > Usuarios > Detalle',
            currentPage: 'admin-users',
            userDetail: user,
            user: req.user
        });
    } catch (error) {
        console.error('Error al obtener detalle del usuario:', error);
        req.flash('error', 'Error al cargar el detalle del usuario.');
        res.redirect('/admin/users');
    }
});

// Actualizar estado de credenciales SAP de un usuario
router.post('/users/:id/sap-credentials', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { action } = req.body; // 'validate' o 'invalidate'
        
        const user = await User.findById(userId);
        if (!user) {
            req.flash('error', 'Usuario no encontrado.');
            return res.redirect('/admin/users');
        }
        
        if (action === 'invalidate') {
            await user.invalidateSapCredentials();
            req.flash('success', 'Credenciales SAP marcadas como inválidas.');
        } else if (action === 'validate') {
            user.sapCredentials.isValid = true;
            await user.save();
            req.flash('success', 'Credenciales SAP marcadas como válidas.');
        }
        
        res.redirect(`/admin/users/${userId}`);
    } catch (error) {
        console.error('Error al actualizar credenciales SAP:', error);
        req.flash('error', 'Error al actualizar las credenciales SAP.');
        res.redirect(`/admin/users/${req.params.id}`);
    }
});

// Eliminar usuario (solo si no es el usuario actual)
router.post('/users/:id/delete', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // No permitir eliminar el propio usuario
        if (userId === req.user._id.toString()) {
            req.flash('error', 'No puedes eliminar tu propia cuenta.');
            return res.redirect('/admin/users');
        }
        
        const user = await User.findById(userId);
        if (!user) {
            req.flash('error', 'Usuario no encontrado.');
            return res.redirect('/admin/users');
        }
        
        await User.findByIdAndDelete(userId);
        req.flash('success', `Usuario ${user.name} eliminado correctamente.`);
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        req.flash('error', 'Error al eliminar el usuario.');
        res.redirect('/admin/users');
    }
});

module.exports = router;
