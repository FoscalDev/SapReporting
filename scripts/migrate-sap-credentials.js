const mongoose = require('mongoose');
require('dotenv').config();
const EncryptionUtils = require('../utils/encryption');

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sap-reports', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const User = require('../models/User');

async function migrateSapCredentials() {
    try {
        console.log('🔐 Iniciando migración de credenciales SAP...');
        
        // Buscar usuarios con credenciales SAP no encriptadas
        const users = await User.find({
            'sapCredentials.password': { $exists: true, $ne: null },
            'sapCredentials.password': { $not: /^\$2[abxy]\$\d{1,2}\$/ } // No empiezan con bcrypt
        });
        
        console.log(`📊 Encontrados ${users.length} usuarios con credenciales para migrar`);
        
        if (users.length === 0) {
            console.log('✅ No hay credenciales que migrar');
            return;
        }
        
        let migrated = 0;
        let errors = 0;
        
        for (const user of users) {
            try {
                const oldPassword = user.sapCredentials.password;
                
                // Verificar si ya está encriptada
                if (EncryptionUtils.isEncrypted(oldPassword)) {
                    console.log(`⏭️  Usuario ${user.email} ya tiene contraseña encriptada, saltando...`);
                    continue;
                }
                
                console.log(`🔄 Migrando credenciales para usuario: ${user.email}`);
                
                // Encriptar la contraseña
                const encryptedPassword = await EncryptionUtils.encryptPassword(oldPassword);
                
                // Actualizar el usuario
                user.sapCredentials.password = encryptedPassword;
                await user.save();
                
                migrated++;
                console.log(`✅ Migrado exitosamente: ${user.email}`);
                
            } catch (error) {
                console.error(`❌ Error migrando usuario ${user.email}:`, error.message);
                errors++;
            }
        }
        
        console.log('\n📈 Resumen de migración:');
        console.log(`✅ Usuarios migrados exitosamente: ${migrated}`);
        console.log(`❌ Errores: ${errors}`);
        console.log(`📊 Total procesados: ${users.length}`);
        
        if (errors === 0) {
            console.log('\n🎉 ¡Migración completada exitosamente!');
        } else {
            console.log('\n⚠️  Migración completada con algunos errores. Revisa los logs.');
        }
        
    } catch (error) {
        console.error('💥 Error durante la migración:', error);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Conexión a MongoDB cerrada');
    }
}

// Ejecutar migración
migrateSapCredentials();
