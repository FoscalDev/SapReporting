const mongoose = require('mongoose');
const MenuItem = require('../models/MenuConfig');
require('dotenv').config();

// Datos de menús por defecto
const defaultMenus = [
    // Nivel 1 - Menús principales
    {
        id: 'menu_reports',
        text: 'Reportes de Nómina',
        icon: 'fas fa-chart-bar',
        route: '#',
        level: 1,
        order: 1
    },
    {
        id: 'menu_admin',
        text: 'Administración',
        icon: 'fas fa-cog',
        route: '#',
        level: 1,
        order: 2
    },
    
    // Nivel 2 - Submenús de Reportes
    {
        id: 'menu_reports_salarios',
        text: 'Salarios Nómina',
        icon: 'fas fa-money-bill-wave',
        route: '/reports',
        level: 2,
        parentId: 'menu_reports',
        order: 1
    },
    {
        id: 'menu_reports_resumen',
        text: 'Resumen Organizacional',
        icon: 'fas fa-building',
        route: '/summary/organizational-units',
        level: 2,
        parentId: 'menu_reports',
        order: 2
    },
    {
        id: 'menu_reports_busqueda',
        text: 'Búsqueda Avanzada',
        icon: 'fas fa-search',
        route: '/search',
        level: 2,
        parentId: 'menu_reports',
        order: 3
    },
    
    // Nivel 2 - Submenús de Administración
    {
        id: 'menu_admin_users',
        text: 'Gestión de Usuarios',
        icon: 'fas fa-users',
        route: '/admin/users',
        level: 2,
        parentId: 'menu_admin',
        order: 1
    },
    {
        id: 'menu_admin_menu_config',
        text: 'Configuración de Menús',
        icon: 'fas fa-bars',
        route: '/admin/menu-config',
        level: 2,
        parentId: 'menu_admin',
        order: 2
    }
];

async function initializeMenus() {
    try {
        // Conectar a MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sap-reports', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Conectado a MongoDB');
        
        // Limpiar menús existentes
        await MenuItem.deleteMany({});
        console.log('🗑️ Menús existentes eliminados');
        
        // Crear menús por defecto
        for (const menuData of defaultMenus) {
            const menuItem = new MenuItem(menuData);
            await menuItem.save();
            console.log(`✅ Menú creado: ${menuData.text} (${menuData.id})`);
        }
        
        console.log('🎉 Menús por defecto inicializados correctamente');
        
        // Mostrar estructura creada
        const menuStructure = await MenuItem.find({ isActive: true })
            .sort({ level: 1, order: 1 });
        
        console.log('\n📋 Estructura de menús creada:');
        menuStructure.forEach(menu => {
            const indent = '  '.repeat(menu.level - 1);
            const parentInfo = menu.parentId ? ` (hijo de: ${menu.parentId})` : '';
            console.log(`${indent}📁 ${menu.text}${parentInfo} -> ${menu.route}`);
        });
        
    } catch (error) {
        console.error('❌ Error al inicializar menús:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Desconectado de MongoDB');
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    initializeMenus();
}

module.exports = { initializeMenus, defaultMenus };
