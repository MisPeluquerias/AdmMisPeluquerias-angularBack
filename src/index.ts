import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import Login from './controllers/login/login';
import Home from './controllers/home/home';
import Clients from './controllers/clients/clients';
import Cities from './controllers/cities/cities';
import Categories from './controllers/categories/categories';
import Export from './controllers/export/export';
import Import from './controllers/import/import';
import Administrators from './controllers/administrators/administrators';
import Contact from './controllers/contact/contact';
import ContactProffesional from './controllers/contact-proffesional/contact-proffesional';
import Reclamations from './controllers/reclamations/reclamation';
import Services from './controllers/services/services';
import EditHome from './controllers/edit-home/edit-home';
import ImageUpload from './controllers/edit-home/imageUpload'; // Importa el nuevo router

const app = express();
app.use(express.json());
app.use(cors());

// Servir archivos estáticos desde el directorio "uploads"
app.use('/uploads', express.static(path.join(__dirname, '../dist/uploads')));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Access-Control-Allow-Headers, Authorization, Accept");
    next();
});

app.use('/login', Login);
app.use('/home', Home);
app.use('/clients', Clients);
app.use('/cities', Cities);
app.use('/categories', Categories);
app.use('/export', Export);
app.use('/import', Import);
app.use('/administrators', Administrators);
app.use('/contact', Contact);
app.use('/contact-proffesional', ContactProffesional);
app.use('/reclamations', Reclamations);
app.use('/services', Services);
app.use('/edithome', EditHome);
app.use('/edithomeimages', ImageUpload); // Usa el nuevo router

// Inicia el servidor en el puerto 3000
app.listen(3000, () => {
  console.log('Servidor iniciado en http://localhost:3000');
});
