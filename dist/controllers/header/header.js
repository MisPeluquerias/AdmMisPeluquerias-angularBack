"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../../db/db"));
const router = express_1.default.Router();
const body_parser_1 = __importDefault(require("body-parser"));
const decodeToken_1 = __importDefault(require("../../functions/decodeToken"));
router.use(body_parser_1.default.json());
router.get('/getImgUser', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_user } = req.query;
    // Validar que id_user esté presente
    if (!id_user) {
        return res.status(400).json({ error: 'id_user parameter is required' });
    }
    let decodedIdUser;
    try {
        // Decodificar el token para obtener id_user
        decodedIdUser = (0, decodeToken_1.default)(id_user); // Asegúrate de que decodeToken acepte un string
    }
    catch (err) {
        console.error('Error decoding token:', err);
        return res.status(400).json({ error: 'Invalid token' });
    }
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: 'Error starting transaction' });
        }
        // Ejecutar la consulta
        const query = `
      SELECT avatar_path 
      FROM user 
      WHERE id_user = ?;
  `;
        db_1.default.query(query, [decodedIdUser], (error, results) => {
            if (error) {
                // En caso de error, revertir la transacción
                db_1.default.rollback(() => {
                    console.error('Error executing query:', error);
                    res.status(500).json({ error: 'An error occurred while fetching data' });
                });
                return;
            }
            // Confirmar la transacción
            db_1.default.commit((commitError) => {
                if (commitError) {
                    // En caso de error durante el commit, revertir la transacción
                    db_1.default.rollback(() => {
                        console.error('Error committing transaction:', commitError);
                        res.status(500).json({ error: 'An error occurred while committing transaction' });
                    });
                    return;
                }
                // Enviar los resultados como respuesta
                res.json({ data: results });
            });
        });
    });
}));
exports.default = router;
