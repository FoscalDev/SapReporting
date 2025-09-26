const express = require('express');
const SapODataService = require('../services/sapODataService');
const { requireAuth, requireSapSessionCredentials } = require('../middleware/auth');
const router = express.Router();

// Instancia del servicio SAP
const sapService = new SapODataService();

/**
 * Página principal con listado de empleados
 */
router.get('/', requireAuth, requireSapSessionCredentials, async (req, res) => {
    try {
        // Crear cliente con credenciales del usuario (encriptadas)
        const client = await sapService.createClientWithUserCredentials(req.user, 'salarios-nomina', req.session);
        
        const employees = await sapService.getEmployeesWithClient(client);
        res.render('reports/index', { 
            title: 'Salarios Nómina - SAP',
            breadcrumb: 'Salarios Nómina',
            currentPage: 'salarios-nomina',
            employees: employees,
            totalEmployees: employees.length,
            user: req.user
        });
    } catch (error) {
        console.error('Error en la página principal:', error);
        req.flash('error', error.message);
        res.redirect('/sap-credentials');
    }
});

/**
 * Vista detallada de un empleado específico
 */
router.get('/employee/:id', requireAuth, requireSapSessionCredentials, async (req, res) => {
    try {
        const employeeId = req.params.id;
        const employee = await sapService.getEmployeeById(employeeId);
        
        if (!employee) {
            return res.status(404).render('error', {
                message: 'Empleado no encontrado',
                error: `No se encontró el empleado con ID: ${employeeId}`
            });
        }

        res.render('reports/employee-detail', {
            title: `Detalle del Empleado - ${employee.name}`,
            breadcrumb: `Empleado ${employee.id}`,
            currentPage: 'salaries',
            employee: employee
        });
    } catch (error) {
        console.error('Error al obtener empleado:', error);
        res.render('error', {
            message: 'Error al cargar los datos del empleado',
            error: error.message
        });
    }
});

/**
 * Búsqueda de empleados con filtros
 */
router.get('/search', requireAuth, requireSapSessionCredentials, async (req, res) => {
    try {
        const filters = {
            jobDescription: req.query.job,
            organizationalUnit: req.query.unit,
            personnelArea: req.query.area
        };

        // Remover filtros vacíos
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });

        const employees = await sapService.searchEmployees(filters);
        
        res.render('reports/search-results', {
            title: 'Resultados de Búsqueda',
            breadcrumb: 'Búsqueda Avanzada',
            currentPage: 'search',
            employees: employees,
            filters: filters,
            totalResults: employees.length
        });
    } catch (error) {
        console.error('Error en la búsqueda:', error);
        res.render('error', {
            message: 'Error al realizar la búsqueda',
            error: error.message
        });
    }
});

/**
 * API endpoint para obtener datos en formato JSON
 */
router.get('/api/employees', async (req, res) => {
    try {
        const employees = await sapService.getEmployees();
        res.json({
            success: true,
            data: employees,
            total: employees.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener empleados',
            error: error.message
        });
    }
});

/**
 * API endpoint para obtener un empleado específico en formato JSON
 */
router.get('/api/employee/:id', async (req, res) => {
    try {
        const employeeId = req.params.id;
        const employee = await sapService.getEmployeeById(employeeId);
        
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Empleado no encontrado'
            });
        }

        res.json({
            success: true,
            data: employee
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener empleado',
            error: error.message
        });
    }
});

/**
 * Reporte de resumen por área organizacional
 */
router.get('/summary/organizational-units', requireAuth, requireSapSessionCredentials, async (req, res) => {
    try {
        const employees = await sapService.getEmployees();
        
        // Agrupar empleados por unidad organizacional
        const summary = employees.reduce((acc, employee) => {
            const unitKey = employee.organizationalUnit.description || 'Sin definir';
            
            if (!acc[unitKey]) {
                acc[unitKey] = {
                    unitName: unitKey,
                    unitCode: employee.organizationalUnit.code,
                    totalEmployees: 0,
                    totalSalary: 0,
                    averageSalary: 0,
                    employees: []
                };
            }
            
            acc[unitKey].totalEmployees++;
            acc[unitKey].totalSalary += employee.baseSalary;
            acc[unitKey].employees.push(employee);
            
            return acc;
        }, {});

        // Calcular promedios
        Object.values(summary).forEach(unit => {
            unit.averageSalary = unit.totalSalary / unit.totalEmployees;
        });

        res.render('reports/organizational-summary', {
            title: 'Resumen por Unidad Organizacional',
            breadcrumb: 'Resumen Organizacional',
            currentPage: 'summary',
            summary: Object.values(summary),
            totalUnits: Object.keys(summary).length
        });
    } catch (error) {
        console.error('Error en el resumen organizacional:', error);
        res.render('error', {
            message: 'Error al generar el resumen organizacional',
            error: error.message
        });
    }
});

/**
 * Reporte de rotación de personal
 */
router.get('/personnel-rotation', requireAuth, requireSapSessionCredentials, async (req, res) => {
    try {
        // Verificar que el usuario esté disponible
        if (!req.user) {
            console.error('Usuario no encontrado en la sesión');
            req.flash('error', 'Sesión de usuario no válida');
            return res.redirect('/login');
        }

        // Crear cliente con credenciales del usuario para el servicio de rotación de personal
        const client = await sapService.createClientWithUserCredentials(req.user, 'rotacion-personal', req.session);
        
        // Obtener filtros de la query string (pueden ser múltiples valores separados por coma)
        const filters = {};
        
        if (req.query.companyCode) {
            filters.companyCode = req.query.companyCode.split(',').map(code => code.trim());
        }
        if (req.query.personnelArea) {
            filters.personnelArea = req.query.personnelArea.split(',').map(area => area.trim());
        }
        if (req.query.costCenter) {
            filters.costCenter = req.query.costCenter.split(',').map(center => center.trim());
        }
        if (req.query.jobCode) {
            filters.jobCode = req.query.jobCode.split(',').map(job => job.trim());
        }

        const rotationData = await sapService.getPersonnelRotationWithClient(client, filters);
        
        // Preparar datos únicos para los filtros multi-select
        const uniqueCompanies = [...new Set(rotationData.map(item => item.companyCode))].sort();
        const uniquePersonnelAreas = [...new Set(rotationData.map(item => ({
            code: item.personnelAreaCode,
            description: item.personnelAreaDescr
        })))].sort((a, b) => a.code.localeCompare(b.code));
        const uniqueCostCenters = [...new Set(rotationData.map(item => ({
            code: item.costCenterCode,
            description: item.costCenterDescr
        })))].sort((a, b) => a.code.localeCompare(b.code));
        const uniqueJobs = [...new Set(rotationData.map(item => ({
            code: item.jobCode,
            description: item.jobDescription
        })))].sort((a, b) => a.code.localeCompare(b.code));
        
        res.render('reports/personnel-rotation', { 
            title: 'Rotación de Personal - SAP',
            breadcrumb: 'Rotación de Personal',
            currentPage: 'personnel-rotation',
            rotationData: rotationData,
            totalRecords: rotationData.length,
            filters: filters,
            user: req.user,
            uniqueCompanies: uniqueCompanies,
            uniquePersonnelAreas: uniquePersonnelAreas,
            uniqueCostCenters: uniqueCostCenters,
            uniqueJobs: uniqueJobs
        });
    } catch (error) {
        console.error('Error en el reporte de rotación de personal:', error);
        req.flash('error', error.message);
        res.redirect('/sap-credentials');
    }
});

/**
 * API endpoint para obtener datos de rotación de personal en formato JSON
 */
router.get('/api/personnel-rotation', requireAuth, requireSapSessionCredentials, async (req, res) => {
    try {
        const client = await sapService.createClientWithUserCredentials(req.user, 'rotacion-personal', req.session);
        
        const filters = {
            companyCode: req.query.companyCode,
            personnelArea: req.query.personnelArea,
            costCenter: req.query.costCenter,
            jobCode: req.query.jobCode
        };

        // Remover filtros vacíos
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });

        const rotationData = await sapService.getPersonnelRotationWithClient(client, filters);
        
        res.json({
            success: true,
            data: rotationData,
            total: rotationData.length,
            filters: filters
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener datos de rotación de personal',
            error: error.message
        });
    }
});

/**
 * Indicadores de rotación mensual
 */
router.get('/monthly-rotation-indicators', requireAuth, requireSapSessionCredentials, async (req, res) => {
    try {
        // Verificar que el usuario esté disponible
        if (!req.user) {
            console.error('Usuario no encontrado en la sesión');
            req.flash('error', 'Sesión de usuario no válida');
            return res.redirect('/login');
        }

        // Crear cliente con credenciales del usuario para el servicio de rotación de personal
        const client = await sapService.createClientWithUserCredentials(req.user, 'rotacion-personal', req.session);
        
        // Obtener año y mes de los parámetros (por defecto septiembre 2025)
        const year = parseInt(req.query.year) || 2025;
        const month = parseInt(req.query.month) || 9;

        // Validar parámetros
        if (year < 2020 || year > 2030) {
            req.flash('error', 'Año debe estar entre 2020 y 2030');
            return res.redirect('/reports/personnel-rotation');
        }
        if (month < 1 || month > 12) {
            req.flash('error', 'Mes debe estar entre 1 y 12');
            return res.redirect('/reports/personnel-rotation');
        }

        // Calcular indicadores
        const indicators = await sapService.calculateMonthlyRotationIndicators(client, year, month);
        
        res.render('reports/monthly-rotation-indicators', { 
            title: `Indicadores de Rotación - ${indicators.monthName} ${year}`,
            breadcrumb: `Indicadores de Rotación - ${indicators.monthName} ${year}`,
            currentPage: 'monthly-rotation-indicators',
            indicators: indicators,
            year: year,
            month: month,
            user: req.user
        });
    } catch (error) {
        console.error('Error en los indicadores de rotación mensual:', error);
        req.flash('error', error.message);
        res.redirect('/reports/personnel-rotation');
    }
});

/**
 * API endpoint para obtener indicadores de rotación mensual en formato JSON
 */
router.get('/api/monthly-rotation-indicators', requireAuth, requireSapSessionCredentials, async (req, res) => {
    try {
        const client = await sapService.createClientWithUserCredentials(req.user, 'rotacion-personal', req.session);
        
        const year = parseInt(req.query.year) || 2025;
        const month = parseInt(req.query.month) || 9;

        // Validar parámetros
        if (year < 2020 || year > 2030 || month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: 'Parámetros de año (2020-2030) o mes (1-12) inválidos'
            });
        }

        const indicators = await sapService.calculateMonthlyRotationIndicators(client, year, month);
        
        res.json({
            success: true,
            data: indicators
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al calcular indicadores de rotación mensual',
            error: error.message
        });
    }
});

/**
 * Indicadores de rotación anual
 */
router.get('/annual-rotation-indicators', requireAuth, requireSapSessionCredentials, async (req, res) => {
    try {
        // Verificar que el usuario esté disponible
        if (!req.user) {
            console.error('Usuario no encontrado en la sesión');
            req.flash('error', 'Sesión de usuario no válida');
            return res.redirect('/login');
        }

        // Crear cliente con credenciales del usuario para el servicio de rotación de personal
        const client = await sapService.createClientWithUserCredentials(req.user, 'rotacion-personal', req.session);
        
        // Obtener año de los parámetros (por defecto año actual)
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Validar año
        if (year < 2020 || year > 2030) {
            req.flash('error', 'Año debe estar entre 2020 y 2030');
            return res.redirect('/reports/personnel-rotation');
        }

        // Obtener filtros de la query string (pueden ser múltiples valores separados por coma)
        const filters = {};
        
        if (req.query.companyCode) {
            filters.companyCode = req.query.companyCode.split(',').map(code => code.trim());
        }
        if (req.query.personnelArea) {
            filters.personnelArea = req.query.personnelArea.split(',').map(area => area.trim());
        }
        if (req.query.costCenter) {
            filters.costCenter = req.query.costCenter.split(',').map(center => center.trim());
        }
        if (req.query.jobCode) {
            filters.jobCode = req.query.jobCode.split(',').map(job => job.trim());
        }

        // Obtener opciones de filtros únicas
        const filterOptions = await sapService.getPersonnelRotationFilterOptions(client);
        
        // Calcular indicadores anuales
        const annualIndicators = await sapService.calculateAnnualRotationIndicators(client, year, filters);
        
        res.render('reports/annual-rotation-indicators', { 
            title: `Indicadores de Rotación Anual - ${year}`,
            breadcrumb: `Indicadores de Rotación Anual - ${year}`,
            currentPage: 'annual-rotation-indicators',
            indicators: annualIndicators,
            year: year,
            filters: filters,
            filterOptions: filterOptions,
            user: req.user
        });
    } catch (error) {
        console.error('Error en los indicadores de rotación anual:', error);
        req.flash('error', error.message);
        res.redirect('/reports/personnel-rotation');
    }
});

/**
 * API endpoint para obtener indicadores de rotación anual en formato JSON
 */
router.get('/api/annual-rotation-indicators', requireAuth, requireSapSessionCredentials, async (req, res) => {
    try {
        const client = await sapService.createClientWithUserCredentials(req.user, 'rotacion-personal', req.session);
        
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Validar año
        if (year < 2020 || year > 2030) {
            return res.status(400).json({
                success: false,
                message: 'Año debe estar entre 2020 y 2030'
            });
        }

        // Obtener filtros
        const filters = {};
        
        if (req.query.companyCode) {
            filters.companyCode = req.query.companyCode.split(',').map(code => code.trim());
        }
        if (req.query.personnelArea) {
            filters.personnelArea = req.query.personnelArea.split(',').map(area => area.trim());
        }
        if (req.query.costCenter) {
            filters.costCenter = req.query.costCenter.split(',').map(center => center.trim());
        }
        if (req.query.jobCode) {
            filters.jobCode = req.query.jobCode.split(',').map(job => job.trim());
        }

        const annualIndicators = await sapService.calculateAnnualRotationIndicators(client, year, filters);
        
        res.json({
            success: true,
            data: annualIndicators
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al calcular indicadores de rotación anual',
            error: error.message
        });
    }
});

/**
 * Verificar estado de la conexión con SAP
 */
router.get('/status', async (req, res) => {
    try {
        const isConnected = await sapService.testConnection();
        res.json({
            success: true,
            connected: isConnected,
            timestamp: new Date().toISOString(),
            service: 'SAP OData'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            connected: false,
            message: 'Error al verificar conexión',
            error: error.message
        });
    }
});

module.exports = router;
