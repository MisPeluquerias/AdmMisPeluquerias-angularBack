import express from 'express';
import cors from 'cors';
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
import ProfileUser from './controllers/profileUser/profileUser';
import Aside from './controllers/aside/aside';
import Header from './controllers/header/header'
import NewClient from './controllers/new-client/new-client';
import editClient from './controllers/edit-client/edit-client'
import editAdmin from './controllers/edit-administrator/edit-administrator';
import ownerSalon from './controllers/owner-salon/owner-salon';
import editOwner from './controllers/edit-owner/edit-owner';
import editCity from './controllers/edit-city/edit-city'
import decodePermiso from './functions/decodeTokenPermiso';
import Brands from './controllers/brands/brands';
import categoriesJobs from './controllers/categories-jobs/categories-jobs';
import notifications from './controllers/notifications/notifications';


const app = express();
app.use(express.json());
app.use(cors());


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
app.use('/edithomeimages', ImageUpload);
app.use('/profile-user',ProfileUser);
app.use('/aside',Aside);
app.use('/header',Header);
app.use('/new-client',NewClient);
app.use('/edit-client',editClient);
app.use('/edit-admin',editAdmin);
app.use('/owner-salon',ownerSalon);
app.use('/edit-owner',editOwner);
app.use('/edit-city',editCity);
app.use('/decode-permiso',decodePermiso);
app.use('/brands',Brands);
app.use('/categories-jobs',categoriesJobs);
app.use('/notifications',notifications);
 


app.listen(3000, () => {
  console.log('Servidor iniciado en http://localhost:3000');
});
