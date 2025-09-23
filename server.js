const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('passport');
require('dotenv').config();

// Importar configuración de Passport
require('./config/passport');

const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sap-reports', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Conectado a MongoDB'))
.catch(err => console.error('❌ Error al conectar a MongoDB:', err));

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para parsing de JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'sap-reports-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/sap-reports'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Middleware de flash messages
app.use(flash());

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware para cargar menús dinámicos
const { loadDynamicMenus } = require('./middleware/menuLoader');
app.use(loadDynamicMenus);

// Middleware para hacer user disponible en todas las vistas
app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
});

// Importar rutas
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const sapCredentialsRoutes = require('./routes/sap-credentials');
const adminRoutes = require('./routes/admin');
const menuConfigRoutes = require('./routes/menu-config');
const profilesRoutes = require('./routes/profiles');

// Rutas principales
app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/sap-credentials', sapCredentialsRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/menu-config', menuConfigRoutes);
app.use('/admin/profiles', profilesRoutes);
app.use('/reports', require('./routes/reports'));

// Ruta de inicio
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'SAP Reports Server está funcionando correctamente',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).render('error', {
        message: 'Página no encontrada',
        error: 'La página solicitada no existe'
    });
});

// Manejo de errores generales
app.use((error, req, res, next) => {
    console.error('Error del servidor:', error);
    res.status(500).render('error', {
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Ha ocurrido un error inesperado'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor SAP Reports ejecutándose en http://localhost:${PORT}`);
    console.log(`📊 Accede a los reportes en: http://localhost:${PORT}`);
    console.log(`🔐 Sistema de autenticación con Google OAuth habilitado`);
    console.log(`🔍 Estado del servicio: http://localhost:${PORT}/status`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
