const mongoose = require('mongoose');
const User = require('../models/User');
const Profile = require('../models/Profile');
const UserProfile = require('../models/UserProfile');
require('dotenv').config();

async function assignDefaultProfiles() {
    try {
        // Conectar a MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sap-reports', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Conectado a MongoDB');
        
        // Obtener todos los usuarios
        const users = await User.find();
        console.log(`👥 Encontrados ${users.length} usuarios`);
        
        // Obtener perfil de administrador
        const adminProfile = await Profile.findOne({ name: 'Administrador' });
        
        if (!adminProfile) {
            console.log('❌ No se encontró el perfil de Administrador');
            return;
        }
        
        console.log(`👤 Perfil de administrador encontrado: ${adminProfile.name}`);
        
        // Asignar perfil de administrador a todos los usuarios existentes
        for (const user of users) {
            try {
                // Verificar si ya tiene el perfil asignado
                const existingAssignment = await UserProfile.findOne({
                    user: user._id,
                    profile: adminProfile._id
                });
                
                if (!existingAssignment) {
                    await UserProfile.assignProfileToUser(
                        user._id,
                        adminProfile._id,
                        user._id, // Asignado por el mismo usuario por defecto
                        true // Como perfil primario
                    );
                    console.log(`✅ Perfil de administrador asignado a: ${user.name} (${user.email})`);
                } else {
                    console.log(`⚠️ Usuario ya tiene el perfil: ${user.name} (${user.email})`);
                }
            } catch (error) {
                console.error(`❌ Error al asignar perfil a ${user.name}:`, error.message);
            }
        }
        
        console.log('🎉 Asignación de perfiles completada');
        
        // Mostrar resumen
        const totalAssignments = await UserProfile.countDocuments({ isActive: true });
        const adminAssignments = await UserProfile.countDocuments({ 
            profile: adminProfile._id, 
            isActive: true 
        });
        
        console.log(`\n📊 Resumen:`);
        console.log(`   👥 Total de asignaciones activas: ${totalAssignments}`);
        console.log(`   👤 Asignaciones de administrador: ${adminAssignments}`);
        
    } catch (error) {
        console.error('❌ Error al asignar perfiles:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Desconectado de MongoDB');
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    assignDefaultProfiles();
}

module.exports = { assignDefaultProfiles };
