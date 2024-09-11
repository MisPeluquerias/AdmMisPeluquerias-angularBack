"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../../db/db"));
const body_parser_1 = __importDefault(require("body-parser"));
const decodeToken_1 = __importDefault(require("../../functions/decodeToken"));
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
router.get("/getUserName", (req, res) => {
    const { id_user } = req.query;
    let decodedIdUser;
    try {
        // Decodificar el token para obtener id_user
        decodedIdUser = (0, decodeToken_1.default)(id_user);
        //console.log('Decoded ID User:', decodedIdUser); // Depuración: muestra el ID de usuario decodificado
    }
    catch (err) {
        console.error('Error decoding token:', err);
        return res.status(400).json({ error: 'Invalid token' });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err); // Depuración: error al iniciar la transacción
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        const query = `SELECT name FROM user WHERE id_user = ?`;
        // console.log('Executing query:', query); // Depuración: muestra la consulta que se va a ejecutar
        db_1.default.query(query, [decodedIdUser], (err, results) => {
            if (err) {
                console.error('Error fetching user name:', err); // Depuración: error al ejecutar la consulta
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error fetching user name",
                        error: err,
                    });
                });
            }
            // console.log('Query Results:', results); // Depuración: muestra los resultados obtenidos de la consulta
            db_1.default.commit((err) => {
                if (err) {
                    console.error('Error committing transaction:', err); // Depuración: error al hacer commit
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error committing transaction",
                            error: err,
                        });
                    });
                }
                //console.log('Transaction committed successfully'); // Depuración: transacción exitosa
                res.json({ success: true, data: results });
            });
        });
    });
});
exports.default = router;
