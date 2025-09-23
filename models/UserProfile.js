const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    profile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
        required: true
    },
    isPrimary: {
        type: Boolean,
        default: false
    },
    assignedAt: {
        type: Date,
        default: Date.now
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

// Índice compuesto para evitar duplicados
UserProfileSchema.index({ user: 1, profile: 1 }, { unique: true });
UserProfileSchema.index({ user: 1, isPrimary: 1 });

// Middleware para asegurar que solo un perfil sea primario por usuario
UserProfileSchema.pre('save', async function(next) {
    if (this.isModified('isPrimary') && this.isPrimary) {
        // Remover el estado primario de otros perfiles del mismo usuario
        await this.constructor.updateMany(
            { 
                user: this.user, 
                _id: { $ne: this._id } 
            },
            { isPrimary: false }
        );
    }
    next();
});

// Método estático para obtener perfiles de un usuario
UserProfileSchema.statics.getUserProfiles = function(userId) {
    return this.find({ 
        user: userId, 
        isActive: true 
    })
    .populate('profile')
    .sort({ isPrimary: -1, assignedAt: 1 });
};

// Método estático para obtener el perfil primario de un usuario
UserProfileSchema.statics.getPrimaryProfile = function(userId) {
    return this.findOne({ 
        user: userId, 
        isPrimary: true, 
        isActive: true 
    }).populate('profile');
};

// Método estático para asignar perfil a usuario
UserProfileSchema.statics.assignProfileToUser = async function(userId, profileId, assignedBy, isPrimary = false) {
    try {
        // Verificar si ya existe la asignación
        const existingAssignment = await this.findOne({ user: userId, profile: profileId });
        
        if (existingAssignment) {
            if (!existingAssignment.isActive) {
                existingAssignment.isActive = true;
                existingAssignment.assignedBy = assignedBy;
                existingAssignment.assignedAt = new Date();
                return await existingAssignment.save();
            }
            return existingAssignment;
        }
        
        // Si se está asignando como primario, remover el primario actual
        if (isPrimary) {
            await this.updateMany(
                { user: userId },
                { isPrimary: false }
            );
        }
        
        // Crear nueva asignación
        const userProfile = new this({
            user: userId,
            profile: profileId,
            isPrimary: isPrimary,
            assignedBy: assignedBy
        });
        
        return await userProfile.save();
    } catch (error) {
        throw error;
    }
};

// Método estático para remover perfil de usuario
UserProfileSchema.statics.removeProfileFromUser = function(userId, profileId) {
    return this.updateOne(
        { user: userId, profile: profileId },
        { isActive: false }
    );
};

// Método estático para cambiar perfil primario
UserProfileSchema.statics.setPrimaryProfile = async function(userId, profileId) {
    try {
        // Remover estado primario de todos los perfiles del usuario
        await this.updateMany(
            { user: userId },
            { isPrimary: false }
        );
        
        // Asignar nuevo perfil primario
        return await this.updateOne(
            { user: userId, profile: profileId },
            { isPrimary: true }
        );
    } catch (error) {
        throw error;
    }
};

// Método estático para obtener usuarios de un perfil
UserProfileSchema.statics.getProfileUsers = function(profileId) {
    return this.find({ 
        profile: profileId, 
        isActive: true 
    })
    .populate('user', 'name email picture')
    .populate('assignedBy', 'name email')
    .sort({ assignedAt: 1 });
};

module.exports = mongoose.model('UserProfile', UserProfileSchema);
