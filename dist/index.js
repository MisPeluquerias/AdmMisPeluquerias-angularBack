"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const login_1 = __importDefault(require("./controllers/login/login"));
const home_1 = __importDefault(require("./controllers/home/home"));
const clients_1 = __importDefault(require("./controllers/clients/clients"));
const cities_1 = __importDefault(require("./controllers/cities/cities"));
const categories_1 = __importDefault(require("./controllers/categories/categories"));
const export_1 = __importDefault(require("./controllers/export/export"));
const import_1 = __importDefault(require("./controllers/import/import"));
const administrators_1 = __importDefault(require("./controllers/administrators/administrators"));
const contact_1 = __importDefault(require("./controllers/contact/contact"));
const contact_proffesional_1 = __importDefault(require("./controllers/contact-proffesional/contact-proffesional"));
const reclamation_1 = __importDefault(require("./controllers/reclamations/reclamation"));
const services_1 = __importDefault(require("./controllers/services/services"));
const edit_home_1 = __importDefault(require("./controllers/edit-home/edit-home"));
const imageUpload_1 = __importDefault(require("./controllers/edit-home/imageUpload")); // Importa el nuevo router
const profileUser_1 = __importDefault(require("./controllers/profileUser/profileUser"));
const aside_1 = __importDefault(require("./controllers/aside/aside"));
const header_1 = __importDefault(require("./controllers/header/header"));
const new_client_1 = __importDefault(require("./controllers/new-client/new-client"));
const edit_client_1 = __importDefault(require("./controllers/edit-client/edit-client"));
const edit_administrator_1 = __importDefault(require("./controllers/edit-administrator/edit-administrator"));
const owner_salon_1 = __importDefault(require("./controllers/owner-salon/owner-salon"));
const edit_owner_1 = __importDefault(require("./controllers/edit-owner/edit-owner"));
const edit_city_1 = __importDefault(require("./controllers/edit-city/edit-city"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../dist/uploads')));
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Access-Control-Allow-Headers, Authorization, Accept");
    next();
});
app.use('/login', login_1.default);
app.use('/home', home_1.default);
app.use('/clients', clients_1.default);
app.use('/cities', cities_1.default);
app.use('/categories', categories_1.default);
app.use('/export', export_1.default);
app.use('/import', import_1.default);
app.use('/administrators', administrators_1.default);
app.use('/contact', contact_1.default);
app.use('/contact-proffesional', contact_proffesional_1.default);
app.use('/reclamations', reclamation_1.default);
app.use('/services', services_1.default);
app.use('/edithome', edit_home_1.default);
app.use('/edithomeimages', imageUpload_1.default);
app.use('/profile-user', profileUser_1.default);
app.use('/aside', aside_1.default);
app.use('/header', header_1.default);
app.use('/new-client', new_client_1.default);
app.use('/edit-client', edit_client_1.default);
app.use('/edit-admin', edit_administrator_1.default);
app.use('/owner-salon', owner_salon_1.default);
app.use('/edit-owner', edit_owner_1.default);
app.use('/edit-city', edit_city_1.default);
app.listen(3000, () => {
    console.log('Servidor iniciado en http://localhost:3000');
});
