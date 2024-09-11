import express, { Request, Response } from "express";
import connection from "../../db/db";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const saltRounds = 10;
const router = express.Router();
const SECRET_KEY = 'uN3!pK@9rV$4zF6&hS*8xM2+bC0^wQ1!';

router.use(express.json());

router.post('/', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    //console.log(`Intento de login con email: ${email}`); // Debugging

    if (!email || !password) {
        return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    const query = `SELECT * FROM user WHERE email = ? AND active = 1;`;

    try {
        const [rows]: any = await connection.promise().query(query, [email]);
        const resultado = rows;

        //console.log('Usuario encontrado:', resultado.length > 0); // Debugging

        if (resultado.length > 0) {
            const usuario: any = resultado[0];
            const match = await bcrypt.compare(password, usuario.password);

           //console.log('Coincidencia de contraseña:', match); // Debugging

            if (match) {
                // Genera el token con el id_user
                const token = jwt.sign({ id: usuario.id_user }, SECRET_KEY);
                const usuarioId = jwt.sign({ usuarioId: usuario.id_user }, SECRET_KEY);
                const permiso = jwt.sign({ permiso: usuario.permiso }, SECRET_KEY);
                return res.json({ token,usuarioId,permiso });
           
            } else {
                return res.status(401).json({ message: 'Credenciales inválidas' });
            }
        } else {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }
    } catch (error) {
        console.error('Error en el proceso de autenticación:', error);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
});


export default router;
