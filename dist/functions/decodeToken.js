"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const secretKey = 'uN3!pK@9rV$4zF6&hS*8xM2+bC0^wQ1!';
function decodeToken(token) {
    try {
        // Decodifica el token JWT utilizando la clave secreta
        const decoded = jsonwebtoken_1.default.verify(token, secretKey);
        // Devuelve los datos decodificados del token
        if (decoded && decoded.usuarioId) {
            return decoded.usuarioId; // Corrige el acceso a la propiedad correcta
        }
        else {
            console.error('Token decodificado no contiene usuarioId');
            return null;
        }
    }
    catch (error) {
        // Si ocurre algún error durante la decodificación, se captura aquí
        console.error('Error al decodificar el token:', error);
        return null;
    }
}
exports.default = decodeToken;
