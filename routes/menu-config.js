const express = require('express');
const MenuItem = require('../models/MenuConfig');
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
        // En el futuro se puede agregar un campo 'role' al modelo User
        next();
    } catch (error) {
        console.error('Error en middleware requireAdmin:', error);
        req.flash('error', 'Error de autorización.');
        res.redirect('/login');
    }
};

// Página principal de configuración de menús
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const menuItems = await MenuItem.getMenuStructureForAdmin();
        
        // Organizar menús por nivel para facilitar la visualización
        const menuStructure = {
            level1: menuItems.filter(item => item.level === 1),
            level2: menuItems.filter(item => item.level === 2),
            level3: menuItems.filter(item => item.level === 3)
        };
        
        res.render('admin/menu-config', {
            title: 'Configuración de Menús',
            breadcrumb: 'Administración > Configuración de Menús',
            currentPage: 'menu-config',
            menuItems: menuItems,
            menuStructure: menuStructure,
            user: req.user
        });
    } catch (error) {
        console.error('Error al obtener configuración de menús:', error);
        req.flash('error', 'Error al cargar la configuración de menús.');
        res.redirect('/admin/users');
    }
});

// Crear nuevo elemento de menú
router.post('/create', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { text, icon, route, level, parentId, order } = req.body;
        
        // Validaciones
        if (!text || !level) {
            req.flash('error', 'Texto y nivel son requeridos.');
            return res.redirect('/admin/menu-config');
        }
        
        if (level < 1 || level > 3) {
            req.flash('error', 'El nivel debe estar entre 1 y 3.');
            return res.redirect('/admin/menu-config');
        }
        
        // Generar ID único
        const id = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const menuItem = new MenuItem({
            id: id,
            text: text,
            icon: icon || 'fas fa-circle',
            route: route || '#',
            level: parseInt(level),
            parentId: parentId || null,
            order: parseInt(order) || 0,
            isActive: true
        });
        
        // Validar jerarquía
        if (!menuItem.validateHierarchy()) {
            req.flash('error', 'La jerarquía del menú no es válida.');
            return res.redirect('/admin/menu-config');
        }
        
        await menuItem.save();
        req.flash('success', 'Elemento de menú creado correctamente.');
        res.redirect('/admin/menu-config');
    } catch (error) {
        console.error('Error al crear elemento de menú:', error);
        req.flash('error', 'Error al crear el elemento de menú.');
        res.redirect('/admin/menu-config');
    }
});

// Actualizar elemento de menú
router.post('/:id/update', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { text, icon, route, level, parentId, order, isActive } = req.body;
        
        const menuItem = await MenuItem.findOne({ id: id });
        if (!menuItem) {
            req.flash('error', 'Elemento de menú no encontrado.');
            return res.redirect('/admin/menu-config');
        }
        
        // Actualizar campos
        menuItem.text = text || menuItem.text;
        menuItem.icon = icon || menuItem.icon;
        menuItem.route = route || menuItem.route;
        menuItem.level = level ? parseInt(level) : menuItem.level;
        menuItem.parentId = parentId || null;
        menuItem.order = order ? parseInt(order) : menuItem.order;
        
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
            
            menuItem.isActive = activeValue;
        }
        
        // Validar jerarquía
        if (!menuItem.validateHierarchy()) {
            req.flash('error', 'La jerarquía del menú no es válida.');
            return res.redirect('/admin/menu-config');
        }
        
        await menuItem.save();
        req.flash('success', 'Elemento de menú actualizado correctamente.');
        res.redirect('/admin/menu-config');
    } catch (error) {
        console.error('Error al actualizar elemento de menú:', error);
        req.flash('error', 'Error al actualizar el elemento de menú.');
        res.redirect('/admin/menu-config');
    }
});

// Eliminar elemento de menú
router.post('/:id/delete', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const menuItem = await MenuItem.findOne({ id: id });
        if (!menuItem) {
            req.flash('error', 'Elemento de menú no encontrado.');
            return res.redirect('/admin/menu-config');
        }
        
        // Verificar si tiene hijos
        const children = await MenuItem.getChildren(id);
        if (children.length > 0) {
            req.flash('error', 'No se puede eliminar un elemento que tiene submenús. Elimina primero los submenús.');
            return res.redirect('/admin/menu-config');
        }
        
        await MenuItem.deleteOne({ id: id });
        req.flash('success', 'Elemento de menú eliminado correctamente.');
        res.redirect('/admin/menu-config');
    } catch (error) {
        console.error('Error al eliminar elemento de menú:', error);
        req.flash('error', 'Error al eliminar el elemento de menú.');
        res.redirect('/admin/menu-config');
    }
});

// Obtener opciones para menús padre (AJAX)
router.get('/parent-options/:level', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { level } = req.params;
        const currentLevel = parseInt(level);
        
        let parentLevel = 0;
        if (currentLevel === 2) {
            parentLevel = 1;
        } else if (currentLevel === 3) {
            parentLevel = 2;
        }
        
        const parentOptions = await MenuItem.getByLevelForAdmin(parentLevel);
        
        res.json({
            success: true,
            options: parentOptions.map(item => ({
                id: item.id,
                text: item.text,
                level: item.level
            }))
        });
    } catch (error) {
        console.error('Error al obtener opciones de menú padre:', error);
        res.json({
            success: false,
            error: 'Error al obtener opciones de menú padre'
        });
    }
});

// Reordenar elementos de menú
router.post('/reorder', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { items } = req.body;
        
        for (const item of items) {
            await MenuItem.updateOne(
                { id: item.id },
                { order: item.order }
            );
        }
        
        res.json({
            success: true,
            message: 'Orden actualizado correctamente'
        });
    } catch (error) {
        console.error('Error al reordenar elementos:', error);
        res.json({
            success: false,
            error: 'Error al reordenar elementos'
        });
    }
});

// Toggle estado activo/inactivo
router.post('/:id/toggle', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const menuItem = await MenuItem.findOne({ id: id });
        if (!menuItem) {
            req.flash('error', 'Elemento de menú no encontrado.');
            return res.redirect('/admin/menu-config');
        }
        
        menuItem.isActive = !menuItem.isActive;
        await menuItem.save();
        
        req.flash('success', `Elemento de menú ${menuItem.isActive ? 'activado' : 'desactivado'} correctamente.`);
        res.redirect('/admin/menu-config');
    } catch (error) {
        console.error('Error al cambiar estado del elemento:', error);
        req.flash('error', 'Error al cambiar el estado del elemento.');
        res.redirect('/admin/menu-config');
    }
});

module.exports = router;
