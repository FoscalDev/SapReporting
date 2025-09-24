const express = require('express');
const Profile = require('../models/Profile');
const UserProfile = require('../models/UserProfile');
const MenuItem = require('../models/MenuConfig');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Middleware para verificar si el usuario es administrador
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Debes iniciar sesión para acceder a esta sección.');
            return res.redirect('/login');
        }
        // Por ahora, cualquier usuario autenticado puede ser admin
        // En el futuro se puede agregar validación de perfil específico
        next();
    } catch (error) {
        console.error('Error en middleware requireAdmin:', error);
        req.flash('error', 'Error de autorización.');
        res.redirect('/login');
    }
};

// Página principal de gestión de perfiles
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const profiles = await Profile.find().sort({ name: 1 });
        
        // Obtener estadísticas de cada perfil
        const profilesWithStats = await Promise.all(profiles.map(async (profile) => {
            const userCount = await UserProfile.countDocuments({ 
                profile: profile._id, 
                isActive: true 
            });
            const menuCount = profile.menuItems.length;
            
            return {
                ...profile.toObject(),
                userCount,
                menuCount
            };
        }));
        
        res.render('admin/profiles', {
            title: 'Gestión de Perfiles',
            breadcrumb: 'Administración > Gestión de Perfiles',
            currentPage: 'profiles',
            profiles: profilesWithStats,
            user: req.user,
            success: req.flash('success'),
            error: req.flash('error'),
            info: req.flash('info')
        });
    } catch (error) {
        console.error('Error al obtener perfiles:', error);
        req.flash('error', 'Error al cargar los perfiles.');
        res.redirect('/admin/users');
    }
});

// Crear nuevo perfil
router.post('/create', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, description, permissions, menuItems } = req.body;
        
        // Validaciones
        if (!name || !description) {
            req.flash('error', 'Nombre y descripción son requeridos.');
            return res.redirect('/admin/profiles');
        }
        
        // Procesar permisos correctamente
        const processedPermissions = {};
        if (permissions) {
            Object.keys(permissions).forEach(key => {
                const value = permissions[key];
                if (Array.isArray(value)) {
                    // Si es array (checkbox + hidden), el checkbox está marcado si contiene 'true'
                    processedPermissions[key] = value.includes('true');
                } else {
                    // Si no es array, usar el valor directo
                    processedPermissions[key] = value === 'true' || value === true;
                }
            });
        }
        
        const profile = new Profile({
            name: name.trim(),
            description: description.trim(),
            permissions: processedPermissions,
            menuItems: menuItems || [],
            createdBy: req.user._id
        });
        
        await profile.save();
        req.flash('success', 'Perfil creado correctamente.');
        res.redirect('/admin/profiles');
    } catch (error) {
        console.error('Error al crear perfil:', error);
        if (error.code === 'DUPLICATE_PROFILE') {
            req.flash('error', 'Ya existe un perfil con este nombre.');
        } else {
            req.flash('error', 'Error al crear el perfil.');
        }
        res.redirect('/admin/profiles');
    }
});

// Actualizar perfil
router.post('/:id/update', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, permissions, menuItems, isActive } = req.body;
        
        const profile = await Profile.findById(id);
        if (!profile) {
            req.flash('error', 'Perfil no encontrado.');
            return res.redirect('/admin/profiles');
        }
        
        // Actualizar campos
        profile.name = name?.trim() || profile.name;
        profile.description = description?.trim() || profile.description;
        
        // Procesar permisos correctamente
        if (permissions) {
            const processedPermissions = {};
            Object.keys(permissions).forEach(key => {
                const value = permissions[key];
                if (Array.isArray(value)) {
                    // Si es array (checkbox + hidden), el checkbox está marcado si contiene 'true'
                    processedPermissions[key] = value.includes('true');
                } else {
                    // Si no es array, usar el valor directo
                    processedPermissions[key] = value === 'true' || value === true;
                }
            });
            profile.permissions = processedPermissions;
        }
        
        profile.menuItems = menuItems || profile.menuItems;
        // Manejar estado activo correctamente
        if (isActive !== undefined) {
            let activeValue;
            
            if (Array.isArray(isActive)) {
                // Si es array, el checkbox está marcado si contiene 'true'
                activeValue = isActive.includes('true');
            } else {
                // Si no es array, usar el valor directo
                activeValue = isActive === 'true' || isActive === true;
            }
            
            profile.isActive = activeValue;
        }
        
        await profile.save();
        req.flash('success', 'Perfil actualizado correctamente.');
        res.redirect('/admin/profiles');
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        if (error.code === 'DUPLICATE_PROFILE') {
            req.flash('error', 'Ya existe un perfil con este nombre.');
        } else {
            req.flash('error', 'Error al actualizar el perfil.');
        }
        res.redirect('/admin/profiles');
    }
});

// Eliminar perfil
router.post('/:id/delete', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const profile = await Profile.findById(id);
        if (!profile) {
            req.flash('error', 'Perfil no encontrado.');
            return res.redirect('/admin/profiles');
        }
        
        // Verificar si es un perfil del sistema
        if (profile.isSystemProfile) {
            req.flash('error', 'No se puede eliminar un perfil del sistema.');
            return res.redirect('/admin/profiles');
        }
        
        // Verificar si tiene usuarios asignados
        const userCount = await UserProfile.countDocuments({ 
            profile: id, 
            isActive: true 
        });
        
        if (userCount > 0) {
            req.flash('error', 'No se puede eliminar un perfil que tiene usuarios asignados.');
            return res.redirect('/admin/profiles');
        }
        
        await Profile.findByIdAndDelete(id);
        req.flash('success', 'Perfil eliminado correctamente.');
        res.redirect('/admin/profiles');
    } catch (error) {
        console.error('Error al eliminar perfil:', error);
        req.flash('error', 'Error al eliminar el perfil.');
        res.redirect('/admin/profiles');
    }
});

// Página de configuración de menús para un perfil específico
router.get('/:id/menus', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const profile = await Profile.findById(id);
        if (!profile) {
            req.flash('error', 'Perfil no encontrado.');
            return res.redirect('/admin/profiles');
        }
        
        // Obtener todos los menús disponibles
        const allMenus = await MenuItem.find({ isActive: true }).sort({ level: 1, order: 1 });
        
        // Obtener menús asignados al perfil
        const assignedMenuIds = profile.menuItems.map(id => id.toString());
        
        res.render('admin/profile-menus', {
            title: `Configurar Menús - ${profile.name}`,
            breadcrumb: 'Administración > Perfiles > Configurar Menús',
            currentPage: 'profiles',
            profile: profile,
            allMenus: allMenus,
            assignedMenuIds: assignedMenuIds,
            user: req.user,
            success: req.flash('success'),
            error: req.flash('error'),
            info: req.flash('info')
        });
    } catch (error) {
        console.error('Error al cargar configuración de menús:', error);
        req.flash('error', 'Error al cargar la configuración de menús.');
        res.redirect('/admin/profiles');
    }
});

// Actualizar menús del perfil
router.post('/:id/menus/update', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { menuItems } = req.body;
        
        const profile = await Profile.findById(id);
        if (!profile) {
            req.flash('error', 'Perfil no encontrado.');
            return res.redirect('/admin/profiles');
        }
        
        // Convertir array de strings a ObjectIds
        const menuItemIds = Array.isArray(menuItems) ? menuItems : [];
        
        profile.menuItems = menuItemIds;
        await profile.save();
        
        req.flash('success', 'Menús del perfil actualizados correctamente.');
        res.redirect(`/admin/profiles/${id}/menus`);
    } catch (error) {
        console.error('Error al actualizar menús del perfil:', error);
        req.flash('error', 'Error al actualizar los menús del perfil.');
        res.redirect(`/admin/profiles/${id}/menus`);
    }
});

// Página de usuarios asignados a un perfil
router.get('/:id/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const profile = await Profile.findById(id);
        if (!profile) {
            req.flash('error', 'Perfil no encontrado.');
            return res.redirect('/admin/profiles');
        }
        
        // Obtener usuarios asignados al perfil
        const userProfiles = await UserProfile.getProfileUsers(id);
        
        // Obtener todos los usuarios para el selector
        const allUsers = await User.find().select('name email picture').sort({ name: 1 });
        
        res.render('admin/profile-users', {
            title: `Usuarios del Perfil - ${profile.name}`,
            breadcrumb: 'Administración > Perfiles > Usuarios del Perfil',
            currentPage: 'profiles',
            profile: profile,
            userProfiles: userProfiles,
            allUsers: allUsers,
            user: req.user,
            success: req.flash('success'),
            error: req.flash('error'),
            info: req.flash('info')
        });
    } catch (error) {
        console.error('Error al cargar usuarios del perfil:', error);
        req.flash('error', 'Error al cargar los usuarios del perfil.');
        res.redirect('/admin/profiles');
    }
});

// Asignar usuario a perfil
router.post('/:id/users/assign', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, isPrimary } = req.body;
        
        await UserProfile.assignProfileToUser(
            userId, 
            id, 
            req.user._id, 
            isPrimary === 'true'
        );
        
        req.flash('success', 'Usuario asignado al perfil correctamente.');
        res.redirect(`/admin/profiles/${id}/users`);
    } catch (error) {
        console.error('Error al asignar usuario:', error);
        req.flash('error', 'Error al asignar el usuario al perfil.');
        res.redirect(`/admin/profiles/${id}/users`);
    }
});

// Remover usuario del perfil
router.post('/:id/users/:userId/remove', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id, userId } = req.params;
        
        await UserProfile.removeProfileFromUser(userId, id);
        
        req.flash('success', 'Usuario removido del perfil correctamente.');
        res.redirect(`/admin/profiles/${id}/users`);
    } catch (error) {
        console.error('Error al remover usuario:', error);
        req.flash('error', 'Error al remover el usuario del perfil.');
        res.redirect(`/admin/profiles/${id}/users`);
    }
});

// Cambiar perfil primario de usuario
router.post('/:id/users/:userId/set-primary', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id, userId } = req.params;
        
        await UserProfile.setPrimaryProfile(userId, id);
        
        req.flash('success', 'Perfil primario actualizado correctamente.');
        res.redirect(`/admin/profiles/${id}/users`);
    } catch (error) {
        console.error('Error al cambiar perfil primario:', error);
        req.flash('error', 'Error al cambiar el perfil primario.');
        res.redirect(`/admin/profiles/${id}/users`);
    }
});

// Toggle estado activo/inactivo de perfil
router.post('/:id/toggle', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const profile = await Profile.findById(id);
        if (!profile) {
            req.flash('error', 'Perfil no encontrado.');
            return res.redirect('/admin/profiles');
        }
        
        // Verificar si es un perfil del sistema
        if (profile.isSystemProfile) {
            req.flash('error', 'No se puede desactivar un perfil del sistema.');
            return res.redirect('/admin/profiles');
        }
        
        profile.isActive = !profile.isActive;
        await profile.save();
        
        req.flash('success', `Perfil ${profile.isActive ? 'activado' : 'desactivado'} correctamente.`);
        res.redirect('/admin/profiles');
    } catch (error) {
        console.error('Error al cambiar estado del perfil:', error);
        req.flash('error', 'Error al cambiar el estado del perfil.');
        res.redirect('/admin/profiles');
    }
});

// API para obtener menús disponibles (AJAX)
router.get('/api/available-menus', requireAuth, requireAdmin, async (req, res) => {
    try {
        const menus = await MenuItem.find({ isActive: true }).sort({ level: 1, order: 1 });
        
        res.json({
            success: true,
            menus: menus.map(menu => ({
                _id: menu._id,
                text: menu.text,
                icon: menu.icon,
                route: menu.route,
                level: menu.level,
                parentId: menu.parentId
            }))
        });
    } catch (error) {
        console.error('Error al obtener menús:', error);
        res.json({
            success: false,
            error: 'Error al obtener los menús disponibles'
        });
    }
});

module.exports = router;
