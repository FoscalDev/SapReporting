# Reporte de Rotación de Personal

## Descripción
Este reporte permite visualizar los datos de rotación de personal obtenidos desde el servicio SAP OData `ZCDS_PERS_INIPERIODO_CDS`.

## Características

### Filtros Disponibles
- **Empresa (Código)**: Filtra por código de empresa (CompanyCode)
- **Área de Personal**: Filtra por código de área de personal (PersonnelAreaCode)
- **Centro de Costos**: Filtra por código de centro de costos (CostCenterCode)
- **Código de Cargo**: Filtra por código de cargo/posición (JobCode)

### Datos Mostrados
- ID del empleado
- Nombre del empleado
- Código de empresa
- Área de personal (código y descripción)
- Centro de costos (código y descripción)
- Código de cargo
- Descripción del cargo
- Unidad organizativa (código y descripción)
- Fecha de inicio de contrato
- Horas de contrato

### Estadísticas
El reporte muestra estadísticas en tiempo real:
- Total de registros
- Número de empresas únicas
- Número de áreas únicas
- Número de cargos únicos

## Configuración

### Variable de Entorno
Asegúrate de tener configurada la variable de entorno:
```
SAP_ROTACION_PERSONAL=http://erphana3.fosunab.local:8004/sap/opu/odata/sap/ZCDS_PERS_INIPERIODO_CDS
```

### URL del Servicio
El servicio utiliza la siguiente estructura de URL:
```
/sap/opu/odata/sap/ZCDS_PERS_INIPERIODO_CDS/ZCDS_PERS_INIPERIODO(P_Date=datetime'YYYY-MM-DDTHH:MM:SS')/Set
```

## Uso

1. Accede al reporte desde el menú lateral: "Rotación de Personal"
2. O navega directamente a: `http://localhost:3000/reports/personnel-rotation`
3. Aplica los filtros deseados usando el formulario de filtros
4. Haz clic en "Aplicar Filtros" para ejecutar la consulta
5. Los resultados se mostrarán en la tabla de datos
6. Usa "Limpiar Filtros" para resetear todos los filtros

## API Endpoints

### GET /reports/personnel-rotation
Renderiza la vista principal del reporte con filtros aplicados.

### GET /reports/api/personnel-rotation
Devuelve los datos en formato JSON para uso programático.

Parámetros de query:
- `companyCode`: Código de empresa
- `personnelArea`: Código de área de personal
- `costCenter`: Código de centro de costos
- `jobCode`: Código de cargo

## Estructura de Datos

Los datos devueltos incluyen los siguientes campos:
- `pDate`: Fecha de atención
- `employeeId`: ID del empleado
- `employeeName`: Nombre del empleado
- `costCenterCode`: Código del centro de costos
- `costCenterDescr`: Descripción del centro de costos
- `employeeGroup`: Grupo de personal
- `salaryType`: Tipo de salario
- `contractedHours`: Horas contratadas
- `companyCode`: Código de empresa
- `contractStartDate`: Fecha de inicio de contrato
- `contractEndDate`: Fecha de fin de contrato
- `jobCode`: Código del cargo
- `jobDescription`: Descripción del cargo
- `orgUnitCode`: Código de unidad organizativa
- `orgUnitDescription`: Descripción de unidad organizativa
- `personnelAreaCode`: Código de área de personal
- `personnelAreaDescr`: Descripción de área de personal
