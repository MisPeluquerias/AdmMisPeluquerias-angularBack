import mysql from 'mysql2';
//conexion a la base de datos
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mis_peluquerias',
});

export default connection;