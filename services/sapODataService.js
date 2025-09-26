const axios = require('axios');
const EncryptionUtils = require('../utils/encryption');
require('dotenv').config();

class SapODataService {
    constructor() {
        // URLs por reporte
        this.urls = {
            'salarios-nomina': process.env.SAP_SALARIOS_NOMINA_URL || 'http://www.foscalodata.com/sap/opu/odata/sap/ZHCM_DATOS_NOMINA_SRV',
            'resumen-organizacional': process.env.SAP_RESUMEN_ORG_URL || 'http://www.foscalodata.com/sap/opu/odata/sap/ZHCM_RESUMEN_ORG_SRV',
            'busqueda-avanzada': process.env.SAP_BUSQUEDA_AVANZADA_URL || 'http://www.foscalodata.com/sap/opu/odata/sap/ZHCM_BUSQUEDA_SRV',
            'rotacion-personal': process.env.SAP_ROTACION_PERSONAL || 'http://erphana3.fosunab.local:8004/sap/opu/odata/sap/ZCDS_PERS_INIPERIODO_CDS'
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
     * @param {string|Date|Object} sapDate - Fecha en formato SAP
     * @returns {Date|null} Fecha parseada
     */
    parseSAPDate(sapDate) {
        console.log('parseSAPDate recibió:', {
            value: sapDate,
            type: typeof sapDate,
            isNull: sapDate === null,
            isUndefined: sapDate === undefined
        });
        
        // Si no hay fecha
        if (!sapDate) {
            console.log('parseSAPDate: fecha nula o undefined');
            return null;
        }
        
        // Si ya es un objeto Date, devolverlo
        if (sapDate instanceof Date) {
            console.log('parseSAPDate: ya es Date');
            return sapDate;
        }
        
        // Si es un string, verificar si es una fecha indefinida de SAP
        if (typeof sapDate === 'string') {
            console.log('parseSAPDate: procesando string:', sapDate);
            
            // Verificar fechas indefinidas de SAP
            if (sapDate === '99991231' || 
                sapDate === '/Date(253402214400000)/' || 
                sapDate.includes('9999-12-31') ||
                sapDate.includes('99991231')) {
                console.log('parseSAPDate: fecha indefinida de SAP detectada');
                return null; // Fecha indefinida = sin fecha de fin
            }
            
            const match = sapDate.match(/\/Date\((\d+)\)\//);
            if (match) {
                console.log('parseSAPDate: formato SAP encontrado');
                return new Date(parseInt(match[1]));
            }
            
            // Si es un string de fecha ISO, intentar parsearlo
            if (sapDate.includes('T') || sapDate.includes('-')) {
                console.log('parseSAPDate: formato ISO encontrado');
                const parsed = new Date(sapDate);
                return isNaN(parsed.getTime()) ? null : parsed;
            }
            
            // Si es un número como string (formato YYYYMMDD)
            if (/^\d{8}$/.test(sapDate)) {
                console.log('parseSAPDate: formato YYYYMMDD encontrado');
                const year = parseInt(sapDate.substring(0, 4));
                const month = parseInt(sapDate.substring(4, 6)) - 1; // Los meses en JS son 0-based
                const day = parseInt(sapDate.substring(6, 8));
                
                // Verificar si es fecha indefinida
                if (year === 9999 && month === 11 && day === 31) {
                    console.log('parseSAPDate: fecha indefinida YYYYMMDD detectada');
                    return null;
                }
                
                const parsed = new Date(year, month, day);
                return isNaN(parsed.getTime()) ? null : parsed;
            }
            
            console.log('parseSAPDate: string no reconocido');
        }
        
        // Si es un número (formato YYYYMMDD)
        if (typeof sapDate === 'number') {
            console.log('parseSAPDate: procesando número:', sapDate);
            
            // Verificar si es fecha indefinida
            if (sapDate === 99991231) {
                console.log('parseSAPDate: fecha indefinida numérica detectada');
                return null;
            }
            
            const dateStr = sapDate.toString();
            if (dateStr.length === 8) {
                const year = parseInt(dateStr.substring(0, 4));
                const month = parseInt(dateStr.substring(4, 6)) - 1;
                const day = parseInt(dateStr.substring(6, 8));
                
                const parsed = new Date(year, month, day);
                return isNaN(parsed.getTime()) ? null : parsed;
            }
        }
        
        // Si es un objeto con propiedades de fecha (formato OData)
        if (typeof sapDate === 'object' && sapDate !== null) {
            console.log('parseSAPDate: procesando objeto:', sapDate);
            // Intentar diferentes propiedades comunes de fecha
            const dateValue = sapDate.__deferred || sapDate.value || sapDate;
            if (typeof dateValue === 'string') {
                console.log('parseSAPDate: valor de fecha encontrado en objeto');
                const parsed = new Date(dateValue);
                return isNaN(parsed.getTime()) ? null : parsed;
            }
        }
        
        console.log('parseSAPDate: no se pudo parsear, devolviendo null');
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

    /**
     * Obtiene datos de rotación de personal desde el servicio OData específico
     * @param {Object} client - Cliente axios configurado
     * @param {Object} filters - Filtros de búsqueda
     * @returns {Promise<Array>} Array de datos de rotación de personal
     */
    async getPersonnelRotationWithClient(client, filters = {}) {
        try {
            // Construir la URL con parámetros según la estructura del OData
            const currentDate = new Date();
            const dateParam = currentDate.toISOString().split('T')[0];
            
            let url = `/ZCDS_PERS_INIPERIODO(P_Date=datetime'${dateParam}T00:00:00')/Set`;
            
            // Agregar filtros OData si se proporcionan
            const queryParams = [];
            
            if (filters.companyCode && filters.companyCode.length > 0) {
                const companyFilter = filters.companyCode.map(code => `CompanyCode eq '${code}'`).join(' or ');
                queryParams.push(`$filter=(${companyFilter})`);
            }
            if (filters.personnelArea && filters.personnelArea.length > 0) {
                const areaFilter = filters.personnelArea.map(area => `PersonnelAreaCode eq '${area}'`).join(' or ');
                queryParams.push(`$filter=(${areaFilter})`);
            }
            if (filters.costCenter && filters.costCenter.length > 0) {
                const costCenterFilter = filters.costCenter.map(center => `CostCenterCode eq '${center}'`).join(' or ');
                queryParams.push(`$filter=(${costCenterFilter})`);
            }
            if (filters.jobCode && filters.jobCode.length > 0) {
                const jobFilter = filters.jobCode.map(job => `JobCode eq '${job}'`).join(' or ');
                queryParams.push(`$filter=(${jobFilter})`);
            }
            
            if (queryParams.length > 0) {
                url += '?' + queryParams.join(' and ');
            }

            console.log('Obteniendo datos de rotación de personal desde SAP OData...');
            console.log('URL:', url);
            
            const response = await client.get(url);
            
            if (!response.data || !response.data.d || !response.data.d.results) {
                throw new Error('Formato de respuesta inválido del servicio SAP de rotación de personal');
            }

            const rotationData = response.data.d.results.map(item => this.transformPersonnelRotationData(item));
            console.log(`Se obtuvieron ${rotationData.length} registros de rotación de personal`);
            
            return rotationData;
        } catch (error) {
            console.error('Error al obtener datos de rotación de personal desde SAP:', error.message);
            
            // Lanzar el error para que se maneje en las rutas
            throw new Error(`Error al conectar con SAP: ${error.response?.status} - ${error.response?.statusText || error.message}`);
        }
    }

    /**
     * Transforma los datos de rotación de personal para un formato más amigable
     * @param {Object} rawData - Datos raw del OData
     * @returns {Object} Datos transformados
     */
    transformPersonnelRotationData(rawData) {
        return {
            pDate: rawData.P_Date,
            employeeId: rawData.EmployeeID,
            employeeName: rawData.EmployeeName || 'Sin nombre',
            costCenterCode: rawData.CostCenterCode,
            costCenterDescr: rawData.CostCenterDescr,
            employeeGroup: rawData.EmployeeGroup,
            salaryType: rawData.SalaryType,
            contractedHours: parseFloat(rawData.ContractedHours || 0),
            companyCode: rawData.CompanyCode,
            contractStartDate: this.parseSAPDate(rawData.ContractStartDate),
            contractEndDate: rawData.ContractEndDate,
            jobCode: rawData.JobCode,
            jobDescription: rawData.JobDescription,
            orgUnitCode: rawData.OrgUnitCode,
            orgUnitDescription: rawData.OrgUnitDescription,
            personnelAreaCode: rawData.PersonnelAreaCode,
            personnelAreaDescr: rawData.PersonnelAreaDescr
        };
    }

    /**
     * Calcula indicadores de rotación mensual
     * @param {Object} client - Cliente axios configurado
     * @param {number} year - Año a calcular (ej: 2025)
     * @param {number} month - Mes a calcular (1-12, ej: 9 para septiembre)
     * @returns {Promise<Object>} Indicadores de rotación mensual
     */
    async calculateMonthlyRotationIndicators(client, year = 2025, month = 9) {
        try {
            console.log(`Calculando indicadores de rotación para ${month}/${year}`);

            // Fechas importantes para el cálculo
            const currentMonth = new Date(year, month - 1, 1); // Primer día del mes actual
            const previousMonthEnd = new Date(year, month - 1, 0); // Último día del mes anterior
            const currentMonthEnd = new Date(year, month, 0); // Último día del mes actual
            const nextMonthStart = new Date(year, month, 1); // Primer día del mes siguiente

            // Fechas para filtros (formato ISO)
            const startRetirementDate = new Date(year, month - 1, 2); // 02 del mes actual
            const endRetirementDate = new Date(year, month, 1); // 01 del mes siguiente

            console.log('Fechas de cálculo:', {
                currentMonth: currentMonth.toISOString().split('T')[0],
                previousMonthEnd: previousMonthEnd.toISOString().split('T')[0],
                currentMonthEnd: currentMonthEnd.toISOString().split('T')[0],
                startRetirementDate: startRetirementDate.toISOString().split('T')[0],
                endRetirementDate: endRetirementDate.toISOString().split('T')[0]
            });

            // Obtener datos del mes actual
            const currentMonthDateParam = currentMonth.toISOString().split('T')[0];
            let currentUrl = `/ZCDS_PERS_INIPERIODO(P_Date=datetime'${currentMonthDateParam}T00:00:00')/Set`;
            
            const currentResponse = await client.get(currentUrl);
            const currentData = currentResponse.data?.d?.results?.map(item => this.transformPersonnelRotationData(item)) || [];

            // Obtener datos del mes anterior para comparación
            const previousMonthDateParam = previousMonthEnd.toISOString().split('T')[0];
            let previousUrl = `/ZCDS_PERS_INIPERIODO(P_Date=datetime'${previousMonthDateParam}T00:00:00')/Set`;
            
            const previousResponse = await client.get(previousUrl);
            const previousData = previousResponse.data?.d?.results?.map(item => this.transformPersonnelRotationData(item)) || [];

            // Calcular indicadores
            const indicators = this.calculateRotationMetrics(currentData, previousData, {
                year,
                month,
                startRetirementDate,
                endRetirementDate,
                previousMonthEnd,
                currentMonthEnd
            });

            console.log('Indicadores calculados:', indicators);
            return indicators;

        } catch (error) {
            console.error('Error al calcular indicadores de rotación mensual:', error.message);
            throw new Error(`Error al calcular indicadores: ${error.response?.status} - ${error.response?.statusText || error.message}`);
        }
    }

    /**
     * Calcula las métricas de rotación basado en los datos obtenidos
     * @param {Array} currentData - Datos del mes actual
     * @param {Array} previousData - Datos del mes anterior
     * @param {Object} dates - Fechas de referencia
     * @returns {Object} Métricas calculadas
     */
    calculateRotationMetrics(currentData, previousData, dates) {
        const { year, month, startRetirementDate, endRetirementDate, previousMonthEnd, currentMonthEnd } = dates;

        console.log('Datos de entrada para cálculo:', {
            currentDataLength: currentData.length,
            previousDataLength: previousData.length,
            sampleCurrentWorker: currentData[0] ? {
                employeeId: currentData[0].employeeId,
                contractStartDate: currentData[0].contractStartDate,
                contractEndDate: currentData[0].contractEndDate,
                contractEndDateType: typeof currentData[0].contractEndDate
            } : 'No data',
            samplePreviousWorker: previousData[0] ? {
                employeeId: previousData[0].employeeId,
                contractStartDate: previousData[0].contractStartDate,
                contractEndDate: previousData[0].contractEndDate,
                contractEndDateType: typeof previousData[0].contractEndDate
            } : 'No data'
        });

        console.log('Fechas de referencia:', {
            startRetirementDate: startRetirementDate,
            endRetirementDate: endRetirementDate,
            previousMonthEnd: previousMonthEnd,
            currentMonthEnd: currentMonthEnd
        });

        // 1. Trabajadores retirados en el mes (fecha fin entre 02/09 y 01/10)
        const retiredWorkers = currentData.filter(worker => {
            // Verificar si tiene fecha de fin válida (no indefinida)
            if (!worker.contractEndDate || 
                worker.contractEndDate === '/Date(253402214400000)/' ||
                worker.contractEndDate === '99991231' ||
                worker.contractEndDate === 99991231) {
                return false; // Sin fecha de fin o fecha indefinida
            }
            
            const endDate = this.parseSAPDate(worker.contractEndDate);
            if (!endDate) return false;
            
            const isRetired = endDate >= startRetirementDate && endDate <= endRetirementDate;
            
            if (isRetired) {
                console.log('Trabajador retirado encontrado:', {
                    employeeId: worker.employeeId,
                    contractEndDate: worker.contractEndDate,
                    parsedEndDate: endDate,
                    startRetirementDate: startRetirementDate,
                    endRetirementDate: endRetirementDate
                });
            }
            
            return isRetired;
        });

        console.log('Trabajadores retirados encontrados:', retiredWorkers.length);

        // 2. Trabajadores al inicio del período (activos al final del mes anterior)
        const workersAtPeriodStart = previousData.filter(worker => {
            const startDate = worker.contractStartDate;
            const endDate = worker.contractEndDate;
            
            if (!startDate) return false;
            
            // Debe haber iniciado antes o el último día del mes anterior
            const contractStart = this.parseSAPDate(startDate);
            if (!contractStart || contractStart > previousMonthEnd) return false;
            
            // Si no tiene fecha de fin o es indefinida, está activo
            if (!endDate || 
                endDate === '/Date(253402214400000)/' ||
                endDate === '99991231' ||
                endDate === 99991231) return true;
            
            // Si tiene fecha de fin, debe ser después del último día del mes anterior
            const contractEnd = this.parseSAPDate(endDate);
            return contractEnd && contractEnd > previousMonthEnd;
        });

        // Si no hay datos del mes anterior, usar los datos del mes actual como base
        const baseDataForStart = previousData.length > 0 ? previousData : currentData;
        const workersAtPeriodStartAlt = baseDataForStart.filter(worker => {
            const startDate = worker.contractStartDate;
            const endDate = worker.contractEndDate;
            
            if (!startDate) return false;
            
            // Debe haber iniciado antes o el último día del mes anterior
            const contractStart = this.parseSAPDate(startDate);
            if (!contractStart || contractStart > previousMonthEnd) return false;
            
            // Si no tiene fecha de fin o es indefinida, está activo
            if (!endDate || 
                endDate === '/Date(253402214400000)/' ||
                endDate === '99991231' ||
                endDate === 99991231) return true;
            
            // Si tiene fecha de fin, debe ser después del último día del mes anterior
            const contractEnd = this.parseSAPDate(endDate);
            return contractEnd && contractEnd > previousMonthEnd;
        });

        const finalWorkersAtPeriodStart = workersAtPeriodStart.length > 0 ? workersAtPeriodStart : workersAtPeriodStartAlt;

        console.log('Trabajadores al inicio del período:', finalWorkersAtPeriodStart.length);

        // 3. Trabajadores al final del período (activos al final del mes actual + egresos del último día)
        const activeAtMonthEnd = currentData.filter(worker => {
            const startDate = worker.contractStartDate;
            const endDate = worker.contractEndDate;
            
            if (!startDate) return false;
            
            // Debe haber iniciado antes o el último día del mes actual
            const contractStart = this.parseSAPDate(startDate);
            if (!contractStart || contractStart > currentMonthEnd) return false;
            
            // Si no tiene fecha de fin o es indefinida, está activo
            if (!endDate || 
                endDate === '/Date(253402214400000)/' ||
                endDate === '99991231' ||
                endDate === 99991231) return true;
            
            // Si tiene fecha de fin, debe ser el último día del mes o después
            const contractEnd = this.parseSAPDate(endDate);
            return contractEnd && contractEnd >= currentMonthEnd;
        });

        console.log('Trabajadores activos al final del mes:', activeAtMonthEnd.length);

        // Egresos del último día del mes
        const lastDayExits = currentData.filter(worker => {
            if (!worker.contractEndDate || 
                worker.contractEndDate === '/Date(253402214400000)/' ||
                worker.contractEndDate === '99991231' ||
                worker.contractEndDate === 99991231) {
                return false;
            }
            
            const endDate = this.parseSAPDate(worker.contractEndDate);
            if (!endDate) return false;
            
            // Verificar si la fecha de fin es exactamente el último día del mes
            return endDate.getTime() === currentMonthEnd.getTime();
        });

        console.log('Egresos del último día del mes:', lastDayExits.length);

        const workersAtPeriodEnd = activeAtMonthEnd.length + lastDayExits.length;

        // 4. Promedio de trabajadores
        const averageWorkers = (finalWorkersAtPeriodStart.length + workersAtPeriodEnd) / 2;

        // 5. Porcentaje de rotación mensual
        const monthlyRotationPercentage = finalWorkersAtPeriodStart.length > 0 
            ? (retiredWorkers.length / finalWorkersAtPeriodStart.length) * 100 
            : 0;

        console.log('Resumen de cálculos:', {
            retiredWorkers: retiredWorkers.length,
            workersAtPeriodStart: finalWorkersAtPeriodStart.length,
            workersAtPeriodEnd: workersAtPeriodEnd,
            averageWorkers: averageWorkers,
            monthlyRotationPercentage: monthlyRotationPercentage
        });

        return {
            month: month,
            year: year,
            monthName: this.getMonthName(month),
            retiredWorkers: {
                count: retiredWorkers.length,
                list: retiredWorkers
            },
            workersAtPeriodStart: {
                count: finalWorkersAtPeriodStart.length,
                list: finalWorkersAtPeriodStart
            },
            workersAtPeriodEnd: {
                count: workersAtPeriodEnd,
                active: activeAtMonthEnd.length,
                lastDayExits: lastDayExits.length
            },
            averageWorkers: Math.round(averageWorkers * 100) / 100, // Redondear a 2 decimales
            monthlyRotationPercentage: Math.round(monthlyRotationPercentage * 100) / 100, // Redondear a 2 decimales
            calculationDates: {
                startRetirementDate: startRetirementDate.toISOString().split('T')[0],
                endRetirementDate: endRetirementDate.toISOString().split('T')[0],
                previousMonthEnd: previousMonthEnd.toISOString().split('T')[0],
                currentMonthEnd: currentMonthEnd.toISOString().split('T')[0]
            }
        };
    }

    /**
     * Obtiene el nombre del mes en español
     * @param {number} month - Número del mes (1-12)
     * @returns {string} Nombre del mes
     */
    getMonthName(month) {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return months[month - 1] || 'Mes Desconocido';
    }

    /**
     * Obtiene opciones de filtros únicas para rotación de personal
     * @param {Object} client - Cliente SAP autenticado
     * @returns {Object} Opciones de filtros
     */
    async getPersonnelRotationFilterOptions(client) {
        try {
            console.log('Obteniendo opciones de filtros para rotación de personal...');
            
            // Obtener datos sin filtros para extraer opciones únicas
            const allData = await this.getPersonnelRotationWithClient(client, {});
            
            const options = {
                companies: [...new Set(allData.map(item => item.companyCode))].sort(),
                personnelAreas: [...new Set(allData.map(item => ({
                    code: item.personnelAreaCode,
                    description: item.personnelAreaDescr
                })))].sort((a, b) => a.code.localeCompare(b.code)),
                costCenters: [...new Set(allData.map(item => ({
                    code: item.costCenterCode,
                    description: item.costCenterDescr
                })))].sort((a, b) => a.code.localeCompare(b.code)),
                jobs: [...new Set(allData.map(item => ({
                    code: item.jobCode,
                    description: item.jobDescription
                })))].sort((a, b) => a.code.localeCompare(b.code))
            };
            
            console.log('Opciones de filtros obtenidas:', {
                companies: options.companies.length,
                personnelAreas: options.personnelAreas.length,
                costCenters: options.costCenters.length,
                jobs: options.jobs.length
            });
            
            return options;
        } catch (error) {
            console.error('Error al obtener opciones de filtros:', error);
            throw new Error(`Error al obtener opciones de filtros: ${error.message}`);
        }
    }

    /**
     * Calcula indicadores de rotación para todo el año
     * @param {Object} client - Cliente SAP autenticado
     * @param {number} year - Año a calcular
     * @param {Object} filters - Filtros a aplicar
     * @returns {Object} Indicadores anuales
     */
    async calculateAnnualRotationIndicators(client, year, filters = {}) {
        try {
            console.log(`Calculando indicadores de rotación anual para ${year}...`);
            console.log('Filtros aplicados:', filters);
            
            const annualData = {};
            const months = [
                { num: 1, name: 'Enero' },
                { num: 2, name: 'Febrero' },
                { num: 3, name: 'Marzo' },
                { num: 4, name: 'Abril' },
                { num: 5, name: 'Mayo' },
                { num: 6, name: 'Junio' },
                { num: 7, name: 'Julio' },
                { num: 8, name: 'Agosto' },
                { num: 9, name: 'Septiembre' },
                { num: 10, name: 'Octubre' },
                { num: 11, name: 'Noviembre' },
                { num: 12, name: 'Diciembre' }
            ];
            
            // Calcular indicadores para cada mes
            for (const month of months) {
                try {
                    console.log(`Procesando ${month.name} ${year}...`);
                    const monthlyIndicators = await this.calculateMonthlyRotationIndicators(client, year, month.num, filters);
                    
                    annualData[month.num] = {
                        month: month.num,
                        monthName: month.name,
                        ...monthlyIndicators
                    };
                    
                    console.log(`Indicadores de ${month.name} calculados:`, {
                        retirados: monthlyIndicators.retiredWorkers.count,
                        inicio: monthlyIndicators.workersAtPeriodStart.count,
                        final: monthlyIndicators.workersAtPeriodEnd.count,
                        promedio: monthlyIndicators.averageWorkers,
                        porcentaje: monthlyIndicators.monthlyRotationPercentage
                    });
                } catch (error) {
                    console.error(`Error al calcular indicadores para ${month.name} ${year}:`, error);
                    // Continuar con el siguiente mes aunque uno falle
                    annualData[month.num] = {
                        month: month.num,
                        monthName: month.name,
                        error: error.message,
                        retiredWorkers: { count: 0, list: [] },
                        workersAtPeriodStart: { count: 0, list: [] },
                        workersAtPeriodEnd: { count: 0, active: 0, lastDayExits: 0 },
                        averageWorkers: 0,
                        monthlyRotationPercentage: 0
                    };
                }
            }
            
            // Calcular totales anuales
            const totalRetired = Object.values(annualData).reduce((sum, month) => sum + (month.retiredWorkers?.count || 0), 0);
            const totalAverageWorkers = Object.values(annualData).reduce((sum, month) => sum + (month.averageWorkers || 0), 0);
            const averageWorkersPerMonth = totalAverageWorkers / 12;
            const annualRotationPercentage = averageWorkersPerMonth > 0 ? (totalRetired / averageWorkersPerMonth) * 100 : 0;
            
            const result = {
                year: year,
                filters: filters,
                monthlyData: annualData,
                annualTotals: {
                    totalRetired: totalRetired,
                    averageWorkersPerMonth: averageWorkersPerMonth,
                    annualRotationPercentage: annualRotationPercentage
                },
                calculationDate: new Date().toISOString()
            };
            
            console.log('Indicadores anuales calculados:', {
                year: year,
                totalRetired: totalRetired,
                averageWorkersPerMonth: averageWorkersPerMonth,
                annualRotationPercentage: annualRotationPercentage
            });
            
            return result;
        } catch (error) {
            console.error('Error al calcular indicadores anuales:', error);
            throw new Error(`Error al calcular indicadores anuales: ${error.message}`);
        }
    }

}

module.exports = SapODataService;
