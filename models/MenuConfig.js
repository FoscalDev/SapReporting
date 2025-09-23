const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    text: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        default: 'fas fa-circle'
    },
    route: {
        type: String,
        default: '#'
    },
    level: {
        type: Number,
        required: true,
        min: 1,
        max: 3
    },
    parentId: {
        type: String,
        default: null
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    permissions: {
        type: [String],
        default: []
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

// Índices para optimizar consultas
MenuItemSchema.index({ parentId: 1, order: 1 });
MenuItemSchema.index({ level: 1, isActive: 1 });

// Middleware para actualizar updatedAt
MenuItemSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Método para obtener menús por nivel
MenuItemSchema.statics.getByLevel = function(level) {
    return this.find({ level: level, isActive: true }).sort({ order: 1 });
};

// Método para obtener menús por nivel para administración (incluye inactivos)
MenuItemSchema.statics.getByLevelForAdmin = function(level) {
    return this.find({ level: level }).sort({ order: 1 });
};

// Método para obtener hijos de un menú padre
MenuItemSchema.statics.getChildren = function(parentId) {
    return this.find({ parentId: parentId, isActive: true }).sort({ order: 1 });
};

// Método para obtener la estructura completa del menú
MenuItemSchema.statics.getMenuStructure = function() {
    return this.find({ isActive: true }).sort({ level: 1, order: 1 });
};

// Método para obtener la estructura completa del menú para administración (incluye inactivos)
MenuItemSchema.statics.getMenuStructureForAdmin = function() {
    return this.find({}).sort({ level: 1, order: 1 });
};

// Método para validar la jerarquía
MenuItemSchema.methods.validateHierarchy = function() {
    if (this.level === 1) {
        return !this.parentId;
    } else if (this.level === 2) {
        return this.parentId !== null;
    } else if (this.level === 3) {
        // Para nivel 3, el padre debe ser de nivel 2
        return this.parentId !== null;
    }
    return false;
};

// Método para obtener la ruta completa del breadcrumb
MenuItemSchema.methods.getBreadcrumb = async function() {
    const breadcrumb = [{ text: this.text, route: this.route }];
    
    if (this.parentId) {
        const parent = await this.constructor.findById(this.parentId);
        if (parent) {
            const parentBreadcrumb = await parent.getBreadcrumb();
            return [...parentBreadcrumb, ...breadcrumb];
        }
    }
    
    return breadcrumb;
};

module.exports = mongoose.model('MenuItem', MenuItemSchema);
