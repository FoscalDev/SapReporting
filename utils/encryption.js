const bcrypt = require('bcryptjs');

/**
 * Utilidades para encriptado y desencriptado de contraseñas SAP
 */
class EncryptionUtils {
    /**
     * Encripta una contraseña
     * @param {string} password - Contraseña en texto plano
     * @returns {Promise<string>} Contraseña encriptada
     */
    static async encryptPassword(password) {
        try {
            // Usar salt rounds = 12 para mayor seguridad
            const saltRounds = 12;
            const encryptedPassword = await bcrypt.hash(password, saltRounds);
            return encryptedPassword;
        } catch (error) {
            console.error('Error al encriptar contraseña:', error);
            throw new Error('Error al encriptar contraseña');
        }
    }

    /**
     * Desencripta una contraseña (bcrypt no permite desencriptar directamente)
     * Para verificar si una contraseña coincide con la encriptada
     * @param {string} plainPassword - Contraseña en texto plano
     * @param {string} encryptedPassword - Contraseña encriptada
     * @returns {Promise<boolean>} True si coinciden
     */
    static async verifyPassword(plainPassword, encryptedPassword) {
        try {
            const isValid = await bcrypt.compare(plainPassword, encryptedPassword);
            return isValid;
        } catch (error) {
            console.error('Error al verificar contraseña:', error);
            return false;
        }
    }

    /**
     * Verifica si una cadena está encriptada (contiene el prefijo de bcrypt)
     * @param {string} str - Cadena a verificar
     * @returns {boolean} True si está encriptada
     */
    static isEncrypted(str) {
        // bcrypt genera hashes que empiezan con $2a$, $2b$, $2x$, o $2y$
        return typeof str === 'string' && /^\$2[abxy]\$\d{1,2}\$/.test(str);
    }
}

module.exports = EncryptionUtils;
