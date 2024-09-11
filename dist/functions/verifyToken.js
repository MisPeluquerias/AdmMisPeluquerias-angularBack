"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const secretKey = 'uN3!pK@9rV$4zF6&hS*8xM2+bC0^wQ1!'; // Utilizar una variable de entorno para la clave secreta
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.sendStatus(401);
        return;
    }
    const token = authHeader.substring(7);
    try {
        const decodedToken = jsonwebtoken_1.default.verify(token, secretKey);
        if (!decodedToken || !decodedToken.usuarioId) {
            res.status(401).json({ error: 'Token inválido o sin usuarioId' });
            return;
        }
        req.decoded = decodedToken;
        next();
    }
    catch (error) {
        if (error.name === ' jwt expired') {
            res.status(401).json({ error: 'Token expirado' });
        }
        else {
            res.status(401).json({ error: 'Token no válido' });
        }
    }
}
exports.default = verifyToken;
