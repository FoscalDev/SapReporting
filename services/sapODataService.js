const axios = require('axios');
const EncryptionUtils = require('../utils/encryption');
require('dotenv').config();

class SapODataService {
    constructor() {
        // URLs por reporte
        this.urls = {
            'salarios-nomina': process.env.SAP_SALARIOS_NOMINA_URL || 'http://www.foscalodata.com/sap/opu/odata/sap/ZHCM_DATOS_NOMINA_SRV',
            'resumen-organizacional': process.env.SAP_RESUMEN_ORG_URL || 'http://www.foscalodata.com/sap/opu/odata/sap/ZHCM_RESUMEN_ORG_SRV',
            'busqueda-avanzada': process.env.SAP_BUSQUEDA_AVANZADA_URL || 'http://www.foscalodata.com/sap/opu/odata/sap/ZHCM_BUSQUEDA_SRV'
        };
        
        this.baseURL = this.urls['salarios-nomina']; // Por defecto
        this.username = process.env.SAP_USERNAME || '';
        this.password = process.env.SAP_PASSWORD || '';
        
        // Crear instancia de axios con configuración básica
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        // Configurar autenticación básica
        if (this.username && this.password) {
            const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
            this.client.defaults.headers.common['Authorization'] = `Basic ${credentials}`;
        }
    }

    /**
     * Obtiene todos los empleados desde el servicio OData
     * @returns {Promise<Array>} Array de empleados
     */
    async getEmployees() {
        try {
            console.log('Obteniendo datos de empleados desde SAP OData...');
            const response = await this.client.get('/TResultSet');
            
            if (response.data && response.data.d && response.data.d.results) {
                console.log(`Se obtuvieron ${response.data.d.results.length} empleados`);
                return response.data.d.results.map(employee => this.transformEmployeeData(employee));
            }
            
            return [];
        } catch (error) {
            console.error('Error al obtener datos de empleados desde SAP:', error.message);
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Data:', error.response.data);
            }
            
            // Lanzar el error para que se maneje en las rutas
            throw new Error(`Error al conectar con SAP: ${error.response?.status} - ${error.response?.statusText || error.message}`);
        }
    }

    /**
     * Obtiene un empleado específico por ID
     * @param {string} employeeId - ID del empleado
     * @returns {Promise<Object>} Datos del empleado
     */
    async getEmployeeById(employeeId) {
        try {
            console.log(`Obteniendo empleado con ID: ${employeeId}`);
            const response = await this.client.get(`/TResultSet('${employeeId}')`);
            
            if (response.data && response.data.d) {
                return this.transformEmployeeData(response.data.d);
            }
            
            return null;
        } catch (error) {
            console.error(`Error al obtener empleado ${employeeId}:`, error.message);
            throw new Error(`Error al obtener empleado: ${error.message}`);
        }
    }

    /**
     * Busca empleados por criterios específicos
     * @param {Object} filters - Filtros de búsqueda
     * @returns {Promise<Array>} Array de empleados filtrados
     */
    async searchEmployees(filters = {}) {
        try {
            let url = '/TResultSet';
            const queryParams = [];

            // Construir parámetros de consulta OData
            if (filters.jobDescription) {
                queryParams.push(`$filter=substringof('${filters.jobDescription}',Jobdescription)`);
            }
            if (filters.organizationalUnit) {
                queryParams.push(`$filter=substringof('${filters.organizationalUnit}',Orgunitdescription)`);
            }
            if (filters.personnelArea) {
                queryParams.push(`$filter=Personnelareacode eq '${filters.personnelArea}'`);
            }

            if (queryParams.length > 0) {
                url += '?' + queryParams.join(' and ');
            }

            console.log('Buscando empleados con filtros:', filters);
            const response = await this.client.get(url);
            
            if (response.data && response.data.d && response.data.d.results) {
                console.log(`Se encontraron ${response.data.d.results.length} empleados`);
                return response.data.d.results.map(employee => this.transformEmployeeData(employee));
            }
            
            return [];
        } catch (error) {
            console.error('Error al buscar empleados:', error.message);
            throw new Error(`Error al buscar empleados: ${error.message}`);
        }
    }

    /**
     * Transforma los datos del empleado para un formato más amigable
     * @param {Object} rawData - Datos raw del OData
     * @returns {Object} Datos transformados
     */
    transformEmployeeData(rawData) {
        return {
            id: rawData.Employeeid,
            name: rawData.Employeeename || 'Sin nombre',
            jobCode: rawData.Jobcode,
            jobDescription: rawData.Jobdescription,
            organizationalUnit: {
                code: rawData.Orgunitcode,
                description: rawData.Orgunitdescription
            },
            personnelArea: {
                code: rawData.Personnelareacode,
                description: rawData.Personnelareadescr
            },
            costCenter: {
                code: rawData.Costcentercode,
                description: rawData.Costcenterdescr
            },
            employeeGroup: rawData.Employeegroup,
            salaryType: rawData.Salarytype,
            contractedHours: parseFloat(rawData.Contractedhours || 0),
            baseSalary: parseFloat(rawData.Basesalary || 0),
            companyCode: rawData.Companycode,
            contractStartDate: this.parseSAPDate(rawData.Contractstartdate),
            contractEndDate: this.parseSAPDate(rawData.Contractenddate),
            bonuses: {
                replacement: parseFloat(rawData.Bonificacionreemplazo || 0),
                others: parseFloat(rawData.Otrasbonificaciones || 0),
                specialty: parseFloat(rawData.Bonficacionesespecialidad || 0),
                transportation: parseFloat(rawData.Auxrodamiento || 0)
            },
            average3Months: parseFloat(rawData.Avg3meses || 0)
        };
    }

    /**
     * Parsea las fechas de SAP que vienen en formato /Date(timestamp)/
     * @param {string} sapDate - Fecha en formato SAP
     * @returns {Date|null} Fecha parseada
     */
    parseSAPDate(sapDate) {
        if (!sapDate || sapDate === '/Date(253402214400000)/') {
            return null; // Fecha muy lejana en el futuro indica "sin fecha de fin"
        }
        
        const match = sapDate.match(/\/Date\((\d+)\)\//);
        if (match) {
            return new Date(parseInt(match[1]));
        }
        
        return null;
    }

    /**
     * Verifica la conexión con el servicio SAP
     * @returns {Promise<boolean>} True si la conexión es exitosa
     */
    async testConnection() {
        try {
            const response = await this.client.get('/$metadata');
            return response.status === 200;
        } catch (error) {
            console.error('Error al verificar conexión:', error.message);
            return false;
        }
    }

    // Método para obtener URL según el tipo de reporte
    getBaseURL(reportType) {
        return this.urls[reportType] || this.urls['salarios-nomina'];
    }

    // Método para probar conexión con credenciales específicas
    async testConnectionWithCredentials(username, password, reportType = 'salarios-nomina') {
        try {
            const baseURL = this.getBaseURL(reportType);
            console.log(`🔍 Probando conexión a: ${baseURL}`);
            console.log(`👤 Usuario: ${username}`);
            
            // Primero probar si el servicio está disponible
            try {
                const testResponse = await axios.get(`${baseURL}/`, {
                    timeout: 10000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'SAP-Reports-Client/1.0'
                    }
                });
                console.log(`🌐 Servicio disponible - Status: ${testResponse.status}`);
            } catch (testError) {
                if (testError.response?.status === 401) {
                    console.log(`🔐 Servicio requiere autenticación`);
                } else {
                    console.log(`❌ Servicio no disponible: ${testError.message}`);
                    return { 
                        success: false, 
                        error: 'El servicio SAP no está disponible o no responde correctamente',
                        details: {
                            status: testError.response?.status,
                            url: testError.config?.url
                        }
                    };
                }
            }
            
            // Ahora probar con credenciales (usando el mismo método que funcionaba antes)
            console.log(`🔑 Enviando credenciales para usuario: ${username}`);
            
            // Crear cliente con credenciales como en el constructor original
            const credentials = Buffer.from(`${username}:${password}`).toString('base64');
            
            const response = await axios.get(`${baseURL}/TResultSet`, {
                timeout: 15000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'SAP-Reports-Client/1.0',
                    'Authorization': `Basic ${credentials}`
                }
            });
            
            console.log(`✅ Conexión exitosa - Status: ${response.status}`);
            return { success: true, message: 'Conexión exitosa' };
        } catch (error) {
            console.error('❌ Error al probar conexión SAP:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                message: error.message,
                url: error.config?.url
            });
            
            let errorMessage = 'Error de conexión con SAP';
            
            if (error.response?.status === 401) {
                errorMessage = 'Credenciales inválidas. Verifica usuario y contraseña SAP. Posibles causas:\n' +
                    '• Usuario o contraseña incorrectos\n' +
                    '• Usuario no tiene permisos para servicios OData\n' +
                    '• Usuario está bloqueado o inactivo\n' +
                    '• El servicio requiere autenticación diferente';
            } else if (error.response?.status === 403) {
                errorMessage = 'Acceso denegado. El usuario no tiene permisos para acceder al servicio OData.';
            } else if (error.response?.status === 404) {
                errorMessage = 'Servicio OData no encontrado. Verifica la URL del servicio.';
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'No se puede conectar al servidor SAP. Verifica la URL y que el servidor esté disponible.';
            } else if (error.code === 'ETIMEDOUT') {
                errorMessage = 'Timeout de conexión. El servidor SAP no responde.';
            }
            
            return { 
                success: false, 
                error: errorMessage,
                details: {
                    status: error.response?.status,
                    url: error.config?.url
                }
            };
        }
    }

    // Método para crear cliente con credenciales específicas
    createClientWithCredentials(username, password, reportType = 'salarios-nomina') {
        const baseURL = this.getBaseURL(reportType);
        
        // Crear cliente igual que en el constructor original
        const client = axios.create({
            baseURL: baseURL,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        // Configurar autenticación básica igual que en el constructor
        if (username && password) {
            const credentials = Buffer.from(`${username}:${password}`).toString('base64');
            client.defaults.headers.common['Authorization'] = `Basic ${credentials}`;
        }
        
        return client;
    }

    // Método para crear cliente con credenciales encriptadas de usuario
    async createClientWithUserCredentials(user, reportType = 'salarios-nomina', session) {
        if (!user.hasSapCredentials()) {
            throw new Error('El usuario no tiene credenciales SAP configuradas');
        }

        const credentials = user.getSapCredentials();
        const baseURL = this.getBaseURL(reportType);
        
        // Crear cliente
        const client = axios.create({
            baseURL: baseURL,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        // Verificar si tenemos la contraseña desencriptada en la sesión de Express
        if (session && session.sapTempPassword) {
            const authCredentials = Buffer.from(`${credentials.username}:${session.sapTempPassword}`).toString('base64');
            client.defaults.headers.common['Authorization'] = `Basic ${authCredentials}`;
        } else {
            throw new Error('Credenciales SAP no disponibles en sesión. Por favor, reconecta.');
        }
        
        return client;
    }


    // Método para obtener empleados con cliente específico
    async getEmployeesWithClient(client) {
        try {
            const response = await client.get('/TResultSet');
            
            if (!response.data || !response.data.d || !response.data.d.results) {
                throw new Error('Formato de respuesta inválido del servicio SAP');
            }

            const employees = response.data.d.results.map(employee => this.transformEmployeeData(employee));
            return employees;
        } catch (error) {
            console.error('Error al obtener empleados desde SAP:', error.message);
            
            // Lanzar el error para que se maneje en las rutas
            throw new Error(`Error al conectar con SAP: ${error.response?.status} - ${error.response?.statusText || error.message}`);
        }
    }

}

module.exports = SapODataService;
