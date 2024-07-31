import Login from './controllers/login/login';
import express from 'express';
import cors from 'cors';
import Home from './controllers/home/home';
import Clients from './controllers/clients/clients';
import Cities from './controllers/cities/cities';
import Categories from './controllers/categories/categories';
import Export from './controllers/export/export';
import Import from './controllers/import/import';
import Administrators from './controllers/administrators/administrators';
import Contact from './controllers/contact/contact';
import ContactProffesional from './controllers/contact-proffesional/contact-proffesional'

const app = express();
app.use(express.json());

app.use(cors());


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type,Access-Control-Allow-Headers, Authorization, Accept");
    next();
  });

  app.use('/login',Login);
  app.use('/home',Home);
  app.use('/clients',Clients);
  app.use('/cities',Cities);
  app.use('/categories',Categories);
  app.use('/export',Export);
  app.use('/import', Import);
  app.use('/administrators',Administrators);
  app.use ('/contact',Contact);
  app.use ('/contact-proffesional',ContactProffesional
  )

  app.listen(3000, () => {
    console.log('Servidor iniciado en http://localhost:3000');
  });