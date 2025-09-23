const mongoose = require('mongoose');
const EncryptionUtils = require('../utils/encryption');

const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    name: {
        type: String,
        required: true
    },
    picture: {
        type: String
    },
    sapCredentials: {
        username: {
            type: String,
            default: null
        },
        password: {
            type: String,
            default: null
        },
        lastUpdated: {
            type: Date,
            default: null
        },
        isValid: {
            type: Boolean,
            default: false
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware para actualizar updatedAt
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Método para verificar si las credenciales SAP están configuradas
userSchema.methods.hasSapCredentials = function() {
    return this.sapCredentials.username && this.sapCredentials.password;
};

// Método para obtener credenciales SAP desencriptadas (solo para uso interno)
userSchema.methods.getSapCredentials = function() {
    if (!this.hasSapCredentials()) {
        return null;
    }
    
    return {
        username: this.sapCredentials.username,
        encryptedPassword: this.sapCredentials.password,
        lastUpdated: this.sapCredentials.lastUpdated,
        isValid: this.sapCredentials.isValid
    };
};

// Método para marcar credenciales como inválidas
userSchema.methods.markCredentialsInvalid = function() {
    this.sapCredentials.isValid = false;
    return this.save();
};

// Método para actualizar credenciales SAP
userSchema.methods.updateSapCredentials = async function(username, password) {
    try {
        // Encriptar la contraseña antes de guardarla
        const encryptedPassword = await EncryptionUtils.encryptPassword(password);
        
        this.sapCredentials.username = username;
        this.sapCredentials.password = encryptedPassword;
        this.sapCredentials.lastUpdated = Date.now();
        this.sapCredentials.isValid = true;
        
        return await this.save();
    } catch (error) {
        console.error('Error al actualizar credenciales SAP:', error);
        throw new Error('Error al guardar credenciales SAP');
    }
};

// Método para obtener perfiles del usuario
userSchema.methods.getProfiles = async function() {
    const UserProfile = require('./UserProfile');
    return await UserProfile.getUserProfiles(this._id);
};

// Método para obtener el perfil primario del usuario
userSchema.methods.getPrimaryProfile = async function() {
    const UserProfile = require('./UserProfile');
    return await UserProfile.getPrimaryProfile(this._id);
};

// Método para verificar si el usuario tiene un perfil específico
userSchema.methods.hasProfile = async function(profileId) {
    const UserProfile = require('./UserProfile');
    const userProfile = await UserProfile.findOne({
        user: this._id,
        profile: profileId,
        isActive: true
    });
    return !!userProfile;
};

// Método para verificar si el usuario tiene acceso a un menú específico
userSchema.methods.hasMenuAccess = async function(menuId) {
    const UserProfile = require('./UserProfile');
    const userProfiles = await UserProfile.find({
        user: this._id,
        isActive: true
    }).populate('profile');
    
    for (const userProfile of userProfiles) {
        if (userProfile.profile.hasMenuAccess(menuId)) {
            return true;
        }
    }
    return false;
};

// Método para obtener menús disponibles para el usuario
userSchema.methods.getAvailableMenus = async function() {
    const UserProfile = require('./UserProfile');
    const userProfiles = await UserProfile.find({
        user: this._id,
        isActive: true
    }).populate('profile');
    
    const allMenuIds = new Set();
    
    for (const userProfile of userProfiles) {
        userProfile.profile.menuItems.forEach(menuId => {
            allMenuIds.add(menuId.toString());
        });
    }
    
    const MenuItem = require('./MenuConfig');
    return await MenuItem.find({
        _id: { $in: Array.from(allMenuIds) },
        isActive: true
    }).sort({ level: 1, order: 1 });
};

// Método para construir estructura de menús del usuario
userSchema.methods.buildMenuStructure = async function() {
    const menuItems = await this.getAvailableMenus();
    
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
};

module.exports = mongoose.model('User', userSchema);
