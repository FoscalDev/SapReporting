const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isSystemProfile: {
        type: Boolean,
        default: false
    },
    permissions: {
        canViewReports: {
            type: Boolean,
            default: false
        },
        canViewAdmin: {
            type: Boolean,
            default: false
        },
        canManageUsers: {
            type: Boolean,
            default: false
        },
        canManageMenus: {
            type: Boolean,
            default: false
        },
        canManageProfiles: {
            type: Boolean,
            default: false
        }
    },
    menuItems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

// Índices para optimizar consultas
ProfileSchema.index({ name: 1 });
ProfileSchema.index({ isActive: 1 });

// Middleware para actualizar updatedAt
ProfileSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Método para verificar si el perfil tiene acceso a un menú específico
ProfileSchema.methods.hasMenuAccess = function(menuId) {
    return this.menuItems.some(menuItem => 
        menuItem.toString() === menuId.toString()
    );
};

// Método para agregar menú al perfil
ProfileSchema.methods.addMenuItem = function(menuId) {
    if (!this.hasMenuAccess(menuId)) {
        this.menuItems.push(menuId);
        return this.save();
    }
    return Promise.resolve(this);
};

// Método para remover menú del perfil
ProfileSchema.methods.removeMenuItem = function(menuId) {
    this.menuItems = this.menuItems.filter(menuItem => 
        menuItem.toString() !== menuId.toString()
    );
    return this.save();
};

// Método estático para obtener perfiles activos
ProfileSchema.statics.getActiveProfiles = function() {
    return this.find({ isActive: true }).sort({ name: 1 });
};

// Método estático para obtener perfiles por usuario
ProfileSchema.statics.getProfilesByUser = function(userId) {
    return this.find({ 
        isActive: true,
        $or: [
            { isSystemProfile: true },
            { users: userId }
        ]
    }).sort({ name: 1 });
};

// Método para obtener menús del perfil con detalles
ProfileSchema.methods.getMenuItemsWithDetails = async function() {
    const MenuItem = require('./MenuConfig');
    return await MenuItem.find({ 
        _id: { $in: this.menuItems },
        isActive: true 
    }).sort({ level: 1, order: 1 });
};

// Método para construir estructura de menús del perfil
ProfileSchema.methods.buildMenuStructure = async function() {
    const MenuItem = require('./MenuConfig');
    const menuItems = await this.getMenuItemsWithDetails();
    
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

// Validación personalizada para evitar perfiles duplicados
ProfileSchema.pre('save', async function(next) {
    if (this.isModified('name')) {
        const existingProfile = await this.constructor.findOne({ 
            name: this.name,
            _id: { $ne: this._id }
        });
        
        if (existingProfile) {
            const error = new Error('Ya existe un perfil con este nombre');
            error.code = 'DUPLICATE_PROFILE';
            return next(error);
        }
    }
    next();
});

module.exports = mongoose.model('Profile', ProfileSchema);
