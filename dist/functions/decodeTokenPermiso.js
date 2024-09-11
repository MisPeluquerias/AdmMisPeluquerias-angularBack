"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const secretKey = 'uN3!pK@9rV$4zF6&hS*8xM2+bC0^wQ1!';
const router = express_1.default.Router();
function decodeTokenPermiso(token) {
    try {
        // Decodifica el token JWT utilizando la clave secreta
        const decoded = jsonwebtoken_1.default.verify(token, secretKey);
        return decoded;
    }
    catch (error) {
        // Si ocurre algún error durante la decodificación, se captura aquí
        console.error('Error al decodificar el token:', error);
        return null;
    }
}
router.post('/', (req, res) => {
    const { permiso } = req.body; // Espera recibir el token de permiso en el cuerpo de la solicitud
    const decoded = decodeTokenPermiso(permiso);
    if (decoded && decoded.permiso) {
        res.json({ permiso: decoded.permiso });
    }
    else {
        res.status(400).json({ message: 'Token de permiso inválido' });
    }
});
exports.default = router;
