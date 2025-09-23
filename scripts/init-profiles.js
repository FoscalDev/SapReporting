const mongoose = require('mongoose');
const Profile = require('../models/Profile');
const MenuItem = require('../models/MenuConfig');
require('dotenv').config();

// Datos de perfiles por defecto
const defaultProfiles = [
    {
        name: 'Administrador',
        description: 'Perfil con acceso completo al sistema, incluyendo todas las funciones de administración.',
        isSystemProfile: true,
        permissions: {
            canViewReports: true,
            canViewAdmin: true,
            canManageUsers: true,
            canManageMenus: true,
            canManageProfiles: true
        }
    },
    {
        name: 'Usuario de Reportes',
        description: 'Perfil para usuarios que solo necesitan acceder a los reportes de nómina.',
        isSystemProfile: true,
        permissions: {
            canViewReports: true,
            canViewAdmin: false,
            canManageUsers: false,
            canManageMenus: false,
            canManageProfiles: false
        }
    },
    {
        name: 'Supervisor',
        description: 'Perfil para supervisores que pueden ver reportes y gestionar usuarios básicos.',
        isSystemProfile: true,
        permissions: {
            canViewReports: true,
            canViewAdmin: true,
            canManageUsers: true,
            canManageMenus: false,
            canManageProfiles: false
        }
    }
];

async function initializeProfiles() {
    try {
        // Conectar a MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sap-reports', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Conectado a MongoDB');
        
        // Obtener todos los menús disponibles
        const allMenus = await MenuItem.find({ isActive: true });
        console.log(`📋 Encontrados ${allMenus.length} menús disponibles`);
        
        // Limpiar perfiles existentes (excepto si ya existen perfiles del sistema)
        const existingProfiles = await Profile.find({ isSystemProfile: true });
        if (existingProfiles.length === 0) {
            await Profile.deleteMany({});
            console.log('🗑️ Perfiles existentes eliminados');
        } else {
            console.log('⚠️ Perfiles del sistema ya existen, omitiendo eliminación');
        }
        
        // Crear perfiles por defecto
        for (const profileData of defaultProfiles) {
            // Verificar si ya existe
            const existingProfile = await Profile.findOne({ name: profileData.name });
            
            if (!existingProfile) {
                // Asignar menús según el perfil
                let menuItems = [];
                
                if (profileData.permissions.canViewReports) {
                    // Agregar menús de reportes
                    const reportMenus = allMenus.filter(menu => 
                        menu.route.includes('/reports') || 
                        menu.route.includes('/summary') || 
                        menu.route.includes('/search')
                    );
                    menuItems = menuItems.concat(reportMenus.map(menu => menu._id));
                }
                
                if (profileData.permissions.canViewAdmin) {
                    // Agregar menús de administración
                    const adminMenus = allMenus.filter(menu => 
                        menu.route.includes('/admin')
                    );
                    menuItems = menuItems.concat(adminMenus.map(menu => menu._id));
                }
                
                // Crear perfil
                const profile = new Profile({
                    ...profileData,
                    menuItems: menuItems
                });
                
                await profile.save();
                console.log(`✅ Perfil creado: ${profileData.name} (${menuItems.length} menús asignados)`);
            } else {
                console.log(`⚠️ Perfil ya existe: ${profileData.name}`);
            }
        }
        
        console.log('🎉 Perfiles por defecto inicializados correctamente');
        
        // Mostrar resumen de perfiles creados
        const profiles = await Profile.find().populate('menuItems');
        console.log('\n📊 Resumen de perfiles:');
        profiles.forEach(profile => {
            console.log(`\n👤 ${profile.name}`);
            console.log(`   📝 ${profile.description}`);
            console.log(`   🔐 Permisos: ${Object.keys(profile.permissions).filter(key => profile.permissions[key]).join(', ')}`);
            console.log(`   📋 Menús asignados: ${profile.menuItems.length}`);
            
            if (profile.menuItems.length > 0) {
                console.log('   📁 Menús:');
                profile.menuItems.forEach(menu => {
                    const indent = '  '.repeat(menu.level);
                    console.log(`   ${indent}• ${menu.text} (${menu.route})`);
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Error al inicializar perfiles:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Desconectado de MongoDB');
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    initializeProfiles();
}

module.exports = { initializeProfiles, defaultProfiles };
