# SAP Reports - Sistema de Reportes Empresariales

Sistema web para generar reportes de nómina desde SAP utilizando servicios OData, con autenticación Google OAuth y gestión de credenciales dinámicas.

## 🚀 Características

- **Autenticación Google OAuth**: Login seguro con cuentas de Google
- **Credenciales SAP dinámicas**: Cada usuario configura sus propias credenciales SAP
- **URLs por reporte**: Configuración flexible de endpoints OData
- **Interfaz SAP UI5**: Diseño profesional inspirado en SAP UI5
- **Cálculo de aumentos salariales**: Simulador de aumentos con estadísticas
- **Filtros avanzados**: Búsqueda y filtrado por múltiples criterios
- **Exportación CSV**: Descarga de reportes en formato CSV
- **Base de datos MongoDB**: Almacenamiento seguro de usuarios y credenciales

## 📋 Requisitos Previos

- Node.js 16+ 
- MongoDB 4.4+
- Cuenta de Google para OAuth
- Acceso a servicios SAP OData

## ⚙️ Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd SAPReports
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
```

4. **Editar archivo .env con tus configuraciones:**
```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/sap-reports

# Google OAuth Configuration
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret

# Session Configuration
SESSION_SECRET=tu_session_secret_muy_seguro

# Server Configuration
PORT=3000
NODE_ENV=development

# SAP OData URLs por Reporte
SAP_SALARIOS_NOMINA_URL=http://tu-servidor-sap/sap/opu/odata/sap/ZHCM_DATOS_NOMINA_SRV
SAP_RESUMEN_ORG_URL=http://tu-servidor-sap/sap/opu/odata/sap/ZHCM_RESUMEN_ORG_SRV
SAP_BUSQUEDA_AVANZADA_URL=http://tu-servidor-sap/sap/opu/odata/sap/ZHCM_BUSQUEDA_SRV
```

## 🔧 Configuración de Google OAuth

1. **Ir a Google Cloud Console**
   - https://console.cloud.google.com/

2. **Crear un nuevo proyecto o seleccionar uno existente**

3. **Habilitar Google+ API**
   - APIs & Services > Library
   - Buscar "Google+ API" y habilitarla

4. **Crear credenciales OAuth 2.0**
   - APIs & Services > Credentials
   - Create Credentials > OAuth 2.0 Client IDs
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`

5. **Copiar Client ID y Client Secret al archivo .env**

## 🗄️ Configuración de MongoDB

1. **Instalar MongoDB** (si no está instalado)
```bash
# Ubuntu/Debian
sudo apt-get install mongodb

# macOS con Homebrew
brew install mongodb-community

# Windows: Descargar desde https://www.mongodb.com/try/download/community
```

2. **Iniciar MongoDB**
```bash
# Linux/macOS
mongod

# Windows
net start MongoDB
```

## 🚀 Ejecutar la aplicación

1. **Modo desarrollo** (con auto-reload)
```bash
npm run dev
```

2. **Modo producción**
```bash
npm start
```

3. **Acceder a la aplicación**
   - URL: http://localhost:3000
   - La aplicación redirigirá automáticamente al login de Google

## 📱 Uso de la aplicación

### 1. **Primer acceso**
- Iniciar sesión con Google
- Configurar credenciales SAP
- Acceder a los reportes

### 2. **Configurar credenciales SAP**
- Ir a "Configurar Credenciales SAP"
- Ingresar usuario y contraseña SAP
- El sistema validará las credenciales automáticamente

### 3. **Usar los reportes**
- **Salarios Nómina**: Reporte principal con datos de empleados
- **Cálculo de aumentos**: Simular aumentos salariales
- **Filtros**: Buscar por área, cargo, centro de costo, etc.
- **Exportar**: Descargar datos en CSV

## 🔐 Seguridad

- **Autenticación OAuth**: Solo usuarios autorizados
- **Credenciales encriptadas**: Las credenciales SAP se almacenan de forma segura
- **Sesiones seguras**: Cookies seguras en producción
- **Validación de credenciales**: Verificación automática de credenciales SAP

## 🛠️ Estructura del proyecto

```
SAPReports/
├── config/
│   └── passport.js          # Configuración OAuth
├── middleware/
│   └── auth.js              # Middleware de autenticación
├── models/
│   └── User.js              # Modelo de usuario MongoDB
├── routes/
│   ├── auth.js              # Rutas de autenticación
│   ├── sap-credentials.js   # Gestión de credenciales SAP
│   └── reports.js           # Rutas de reportes
├── services/
│   └── sapODataService.js   # Servicio SAP OData
├── views/
│   ├── auth/
│   │   └── login.ejs        # Página de login
│   ├── sap-credentials/
│   │   └── index.ejs        # Configuración de credenciales
│   └── reports/
│       └── index.ejs        # Reporte principal
├── public/
│   └── css/                 # Estilos CSS
├── .env                     # Variables de entorno
├── package.json
└── server.js               # Servidor principal
```

## 🔧 Configuración de URLs por Reporte

El sistema permite configurar diferentes URLs de SAP OData para cada tipo de reporte:

- `SAP_SALARIOS_NOMINA_URL`: Para reportes de nómina
- `SAP_RESUMEN_ORG_URL`: Para resúmenes organizacionales  
- `SAP_BUSQUEDA_AVANZADA_URL`: Para búsquedas avanzadas

## 🐛 Solución de problemas

### Error de conexión a MongoDB
```bash
# Verificar que MongoDB esté ejecutándose
sudo systemctl status mongod

# Reiniciar MongoDB
sudo systemctl restart mongod
```

### Error de OAuth
- Verificar que las credenciales de Google estén correctas
- Asegurar que la URL de callback esté configurada
- Verificar que Google+ API esté habilitada

### Error de conexión SAP
- Verificar que las credenciales SAP sean correctas
- Comprobar que el servicio OData esté disponible
- Revisar las URLs en el archivo .env

## 📞 Soporte

Para soporte técnico o reportar bugs, contactar al equipo de desarrollo.

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.