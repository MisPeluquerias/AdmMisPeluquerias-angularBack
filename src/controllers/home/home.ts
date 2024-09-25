import express, { Request, Response } from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';

const secretKey = 'uN3!pK@9rV$4zF6&hS*8xM2+bC0^wQ1!';
const router = express.Router();
router.use(bodyParser.json());

function decodeTokenPermiso(token: string): any | null {
  try {
    const decoded: any = jwt.verify(token, secretKey);
    //console.log('Contenido decodificado del token:', decoded); // Imprime el contenido completo
    return decoded;
  } catch (error) {
    console.error('Error al decodificar el token:', error);
    return null;
  }
}

router.get('/getAllSalon', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
  const offset = (page - 1) * pageSize;
  const search = req.query.search ? `%${req.query.search}%` : '%%';
  const filterState = req.query.filterState ? req.query.filterState.toString() : '%%';
  const filterActive = req.query.filterActive === 'true' ? '1' : '0';

  const permisoToken = req.query.permiso as string;
  const usuarioIdToken = req.query.usuarioId as string;

  //console.log('Permiso sin decodificar:', permisoToken);
  //console.log('UsuarioId sin decodificar:', usuarioIdToken);

  let decodedPermiso: any = null;
  let decodedUsuarioId: any = null;

  if (typeof permisoToken === 'string' && typeof usuarioIdToken === 'string') {
    decodedPermiso = decodeTokenPermiso(permisoToken);
    decodedUsuarioId = decodeTokenPermiso(usuarioIdToken);

    //console.log('Token decodificado (permiso):', decodedPermiso);
    //console.log('Token decodificado (usuarioId):', decodedUsuarioId);

    if (!decodedPermiso || !decodedPermiso.permiso) {
      console.error('El token decodificado no contiene el permiso.');
      return res.status(400).json({ message: 'Token de permiso inválido' });
    }

    if (!decodedUsuarioId || !decodedUsuarioId.usuarioId) {
      console.error('El token decodificado no contiene el usuarioId.');
      return res.status(400).json({ message: 'Token de usuarioId inválido' });
    }

    //console.log('Permiso decodificado:', decodedPermiso.permiso);
    //console.log('UsuarioId decodificado:', decodedUsuarioId.usuarioId);

  } else {
    console.error('Permiso o UsuarioId no son válidos');
    return res.status(400).json({ message: 'Permiso o UsuarioId inválidos' });
  }

  let query: string;
  const queryParams: any[] = [];

  if (decodedPermiso.permiso === 'admin') {
    query = `
    SELECT SQL_CALC_FOUND_ROWS * 
    FROM salon 
    WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ? OR state LIKE ?)
  `;
    queryParams.push(search, search, search, search);
  } else {
    query = `
    SELECT s.*
    FROM salon s
    JOIN user_salon us ON s.id_salon = us.id_salon
    WHERE us.id_user = ? AND (s.name LIKE ? OR s.email LIKE ? OR s.phone LIKE ? OR s.state LIKE ?)
  `;
    queryParams.push(decodedUsuarioId.usuarioId, search, search, search, search);
  }

  if (filterActive) {
    query += ' AND active = ?';
    queryParams.push(filterActive);
  }

  if (filterState && filterState !== '%%') {
    query += ' AND state = ?';
    queryParams.push(filterState);
  }

  query += ' LIMIT ?, ?';
  queryParams.push(offset, pageSize);

  connection.query(query, queryParams, (error, results) => {
    if (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'An error occurred while fetching data' });
      return;
    }

    connection.query('SELECT FOUND_ROWS() as totalItems', (countError, countResults) => {
      if (countError) {
        console.error('Error fetching count:', countError);
        res.status(500).json({ error: 'An error occurred while fetching data count' });
        return;
      }

      const totalItems = (countResults as RowDataPacket[])[0]?.totalItems;
      res.json({ data: results, totalItems });
    });
  });
});


export default router;
