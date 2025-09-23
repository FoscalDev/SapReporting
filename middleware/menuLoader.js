const MenuItem = require('../models/MenuConfig');

/**
 * Middleware para cargar menús dinámicos desde la base de datos
 * y hacerlos disponibles en todas las vistas, filtrados por perfil del usuario
 */
const loadDynamicMenus = async (req, res, next) => {
    try {
        let menuItems = [];
        let menuStructure = {};
        let dynamicMenus = false;
        
        if (req.isAuthenticated() && req.user) {
            // Si el usuario está autenticado, cargar menús según su perfil
            try {
                menuStructure = await req.user.buildMenuStructure();
                menuItems = await req.user.getAvailableMenus();
                dynamicMenus = true;
            } catch (profileError) {
                console.error('Error al cargar menús por perfil:', profileError);
                // Fallback a menús estáticos si hay error con perfiles
                menuStructure = getStaticMenuStructure();
                menuItems = [];
                dynamicMenus = false;
            }
        } else {
            // Si no está autenticado, usar menús estáticos
            menuStructure = getStaticMenuStructure();
            menuItems = [];
            dynamicMenus = false;
        }
        
        // Hacer disponible en todas las vistas
        res.locals.menuItems = menuItems;
        res.locals.menuStructure = menuStructure;
        res.locals.dynamicMenus = dynamicMenus;
        
        next();
    } catch (error) {
        console.error('Error al cargar menús dinámicos:', error);
        
        // En caso de error, usar menús estáticos como fallback
        res.locals.menuItems = [];
        res.locals.menuStructure = getStaticMenuStructure();
        res.locals.dynamicMenus = false;
        
        next();
    }
};

/**
 * Construye la estructura jerárquica de menús
 * @param {Array} menuItems - Array de elementos de menú
 * @returns {Object} Estructura organizada por niveles
 */
function buildMenuStructure(menuItems) {
    const structure = {
        level1: [],
        level2: [],
        level3: [],
        hierarchy: {}
    };
    
    // Separar por niveles
    menuItems.forEach(item => {
        if (item.level === 1) {
            structure.level1.push(item);
            structure.hierarchy[item.id] = {
                item: item,
                children: []
            };
        } else if (item.level === 2) {
            structure.level2.push(item);
        } else if (item.level === 3) {
            structure.level3.push(item);
        }
    });
    
    // Construir jerarquía
    menuItems.forEach(item => {
        if (item.parentId && structure.hierarchy[item.parentId]) {
            structure.hierarchy[item.parentId].children.push(item);
        }
    });
    
    return structure;
}

/**
 * Estructura de menú estático como fallback
 */
function getStaticMenuStructure() {
    return {
        level1: [
            {
                id: 'static_reports',
                text: 'Reportes de Nómina',
                icon: 'fas fa-chart-bar',
                route: '#',
                level: 1,
                order: 1
            },
            {
                id: 'static_admin',
                text: 'Administración',
                icon: 'fas fa-cog',
                route: '#',
                level: 1,
                order: 2
            }
        ],
        level2: [
            {
                id: 'static_salarios',
                text: 'Salarios Nómina',
                icon: 'fas fa-money-bill-wave',
                route: '/',
                level: 2,
                parentId: 'static_reports',
                order: 1
            },
            {
                id: 'static_resumen',
                text: 'Resumen Organizacional',
                icon: 'fas fa-building',
                route: '/summary/organizational-units',
                level: 2,
                parentId: 'static_reports',
                order: 2
            },
            {
                id: 'static_busqueda',
                text: 'Búsqueda Avanzada',
                icon: 'fas fa-search',
                route: '/search',
                level: 2,
                parentId: 'static_reports',
                order: 3
            },
            {
                id: 'static_users',
                text: 'Gestión de Usuarios',
                icon: 'fas fa-users',
                route: '/admin/users',
                level: 2,
                parentId: 'static_admin',
                order: 1
            },
            {
                id: 'static_menu_config',
                text: 'Configuración de Menús',
                icon: 'fas fa-bars',
                route: '/admin/menu-config',
                level: 2,
                parentId: 'static_admin',
                order: 2
            }
        ],
        level3: [],
        hierarchy: {
            static_reports: {
                item: {
                    id: 'static_reports',
                    text: 'Reportes de Nómina',
                    icon: 'fas fa-chart-bar'
                },
                children: [
                    {
                        id: 'static_salarios',
                        text: 'Salarios Nómina',
                        icon: 'fas fa-money-bill-wave',
                        route: '/'
                    },
                    {
                        id: 'static_resumen',
                        text: 'Resumen Organizacional',
                        icon: 'fas fa-building',
                        route: '/summary/organizational-units'
                    },
                    {
                        id: 'static_busqueda',
                        text: 'Búsqueda Avanzada',
                        icon: 'fas fa-search',
                        route: '/search'
                    }
                ]
            },
            static_admin: {
                item: {
                    id: 'static_admin',
                    text: 'Administración',
                    icon: 'fas fa-cog'
                },
                children: [
                    {
                        id: 'static_users',
                        text: 'Gestión de Usuarios',
                        icon: 'fas fa-users',
                        route: '/admin/users'
                    },
                    {
                        id: 'static_menu_config',
                        text: 'Configuración de Menús',
                        icon: 'fas fa-bars',
                        route: '/admin/menu-config'
                    }
                ]
            }
        }
    };
}

/**
 * Helper para generar breadcrumb dinámico
 */
const generateBreadcrumb = (currentRoute, menuItems) => {
    try {
        // Buscar el elemento de menú que coincide con la ruta actual
        const currentItem = menuItems.find(item => item.route === currentRoute);
        
        if (!currentItem) {
            return [];
        }
        
        // Construir breadcrumb recursivamente
        const breadcrumb = [];
        let item = currentItem;
        
        while (item) {
            breadcrumb.unshift({
                text: item.text,
                route: item.route
            });
            
            if (item.parentId) {
                item = menuItems.find(i => i.id === item.parentId);
            } else {
                item = null;
            }
        }
        
        return breadcrumb;
    } catch (error) {
        console.error('Error al generar breadcrumb:', error);
        return [];
    }
};

module.exports = {
    loadDynamicMenus,
    generateBreadcrumb,
    getStaticMenuStructure
};
