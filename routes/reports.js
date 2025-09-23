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
