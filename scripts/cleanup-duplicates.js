const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupDuplicates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sap-reports');
        console.log('✅ Conectado a MongoDB');
        
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        
        // Eliminar usuarios duplicados (mantener solo el más reciente)
        const duplicates = await usersCollection.aggregate([
            {
                $group: {
                    _id: '$email',
                    docs: { $push: '$$ROOT' },
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();
        
        console.log(`Encontrados ${duplicates.length} emails duplicados`);
        
        for (const duplicate of duplicates) {
            // Ordenar por fecha de creación (más reciente primero)
            const sortedDocs = duplicate.docs.sort((a, b) => 
                new Date(b.createdAt || b._id.getTimestamp()) - new Date(a.createdAt || a._id.getTimestamp())
            );
            
            // Mantener el más reciente, eliminar los demás
            const toKeep = sortedDocs[0];
            const toDelete = sortedDocs.slice(1);
            
            console.log(`Manteniendo usuario: ${toKeep.email} (${toKeep._id})`);
            
            for (const doc of toDelete) {
                await usersCollection.deleteOne({ _id: doc._id });
                console.log(`Eliminado duplicado: ${doc.email} (${doc._id})`);
            }
        }
        
        console.log('✅ Limpieza completada');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

cleanupDuplicates();
