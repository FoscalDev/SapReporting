/**
 * Helper para generar HTML de menús dinámicos
 */

/**
 * Genera el HTML completo del menú lateral dinámico
 * @param {Object} menuStructure - Estructura de menús
 * @param {String} currentPage - Página actual
 * @param {Boolean} isCollapsed - Si el menú está colapsado
 * @returns {String} HTML del menú
 */
function generateSideMenuHTML(menuStructure, currentPage, isCollapsed = false) {
    if (!menuStructure || !menuStructure.hierarchy) {
        return generateStaticMenuHTML(currentPage, isCollapsed);
    }
    
    let html = '';
    
    // Generar secciones de menú
    Object.keys(menuStructure.hierarchy).forEach(sectionKey => {
        const section = menuStructure.hierarchy[sectionKey];
        html += generateMenuSection(section, currentPage, isCollapsed);
    });
    
    return html;
}

/**
 * Genera una sección de menú (nivel 1 con sus hijos)
 */
function generateMenuSection(section, currentPage, isCollapsed) {
    const { item, children } = section;
    
    let html = `
        <div class="sap-nav-section">
            <div class="sap-nav-section-title">${item.text}</div>
            <ul class="sap-nav-list">
    `;
    
    // Agregar elementos hijos (nivel 2)
    children.forEach(child => {
        html += generateMenuItem(child, currentPage, isCollapsed, 2);
    });
    
    html += `
            </ul>
        </div>
    `;
    
    return html;
}

/**
 * Genera un elemento individual de menú
 */
function generateMenuItem(item, currentPage, isCollapsed, level = 2) {
    const isActive = isMenuItemActive(item, currentPage);
    const activeClass = isActive ? 'active' : '';
    const collapsedClass = isCollapsed ? 'collapsed' : '';
    
    let html = `
        <li class="sap-nav-item">
            <a href="${item.route}" class="sap-nav-link ${activeClass}">
                <i class="${item.icon}"></i>
                <span class="sap-nav-text">${item.text}</span>
            </a>
    `;
    
    // Si tiene hijos (nivel 3), agregarlos
    if (item.children && item.children.length > 0) {
        html += `
            <ul class="sap-nav-submenu">
        `;
        
        item.children.forEach(subChild => {
            html += generateMenuItem(subChild, currentPage, isCollapsed, 3);
        });
        
        html += `
            </ul>
        `;
    }
    
    html += `
        </li>
    `;
    
    return html;
}

/**
 * Verifica si un elemento de menú está activo
 */
function isMenuItemActive(item, currentPage) {
    // Comparación exacta de rutas
    if (item.route === currentPage) {
        return true;
    }
    
    // Comparación por nombre de página
    if (item.id === currentPage) {
        return true;
    }
    
    // Verificar si la ruta actual contiene la ruta del menú
    if (currentPage && currentPage.startsWith(item.route) && item.route !== '#') {
        return true;
    }
    
    return false;
}

/**
 * Genera menú estático como fallback
 */
function generateStaticMenuHTML(currentPage, isCollapsed = false) {
    return `
        <div class="sap-nav-section">
            <div class="sap-nav-section-title">Reportes de Nómina</div>
            <ul class="sap-nav-list">
                <li class="sap-nav-item">
                    <a href="/" class="sap-nav-link ${currentPage === '/' ? 'active' : ''}">
                        <i class="fas fa-money-bill-wave"></i>
                        <span class="sap-nav-text">Salarios Nómina</span>
                    </a>
                </li>
                <li class="sap-nav-item">
                    <a href="/summary/organizational-units" class="sap-nav-link ${currentPage === 'resumen-organizacional' ? 'active' : ''}">
                        <i class="fas fa-building"></i>
                        <span class="sap-nav-text">Resumen Organizacional</span>
                    </a>
                </li>
                <li class="sap-nav-item">
                    <a href="/search" class="sap-nav-link ${currentPage === 'busqueda-avanzada' ? 'active' : ''}">
                        <i class="fas fa-search"></i>
                        <span class="sap-nav-text">Búsqueda Avanzada</span>
                    </a>
                </li>
            </ul>
        </div>
        
        <div class="sap-nav-section">
            <div class="sap-nav-section-title">Administración</div>
            <ul class="sap-nav-list">
                <li class="sap-nav-item">
                    <a href="/admin/users" class="sap-nav-link ${currentPage === 'admin-users' ? 'active' : ''}">
                        <i class="fas fa-users"></i>
                        <span class="sap-nav-text">Gestión de Usuarios</span>
                    </a>
                </li>
                <li class="sap-nav-item">
                    <a href="/admin/menu-config" class="sap-nav-link ${currentPage === 'menu-config' ? 'active' : ''}">
                        <i class="fas fa-bars"></i>
                        <span class="sap-nav-text">Configuración de Menús</span>
                    </a>
                </li>
            </ul>
        </div>
    `;
}

/**
 * Genera breadcrumb dinámico
 */
function generateBreadcrumbHTML(breadcrumb, baseUrl = '') {
    if (!breadcrumb || breadcrumb.length === 0) {
        return '';
    }
    
    let html = '<div class="breadcrumb">';
    
    breadcrumb.forEach((item, index) => {
        if (index > 0) {
            html += ' > ';
        }
        
        if (index === breadcrumb.length - 1) {
            // Último elemento (página actual)
            html += `<span>${item.text}</span>`;
        } else {
            // Elementos anteriores (enlaces)
            html += `<a href="${item.route}">${item.text}</a>`;
        }
    });
    
    html += '</div>';
    
    return html;
}

module.exports = {
    generateSideMenuHTML,
    generateBreadcrumbHTML,
    isMenuItemActive,
    generateStaticMenuHTML
};
