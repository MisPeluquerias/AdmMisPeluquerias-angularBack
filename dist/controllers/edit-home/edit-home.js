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
const body_parser_1 = __importDefault(require("body-parser"));
const { ResultSetHeader } = require('mysql2');
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
router.get("/getSalonById", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id_salon = req.query.id_salon;
    if (!id_salon) {
        return res.status(400).json({ error: "id_salon is required" });
    }
    const query = `
  SELECT 
    s.*,
    ci.name AS city_name,
    ci.zip_code AS city_zip_code,
    p.id_province,
    p.name AS province_name,
    GROUP_CONCAT(
      JSON_OBJECT(
        'id_category', c.id_category,
        'category', c.categories
      )
    ) AS categories,
    ROUND(AVG(r.qualification) * 2) / 2 AS average_rating
  FROM 
    salon s
  LEFT JOIN 
    categories c ON s.id_salon = c.id_salon
  LEFT JOIN
    city ci ON s.id_city = ci.id_city
  LEFT JOIN
    province p ON ci.id_province = p.id_province
  LEFT JOIN
    review r ON r.id_salon = s.id_salon  -- Une las reseñas para calcular el promedio
  WHERE 
    s.id_salon = ?
  GROUP BY 
    s.id_salon;
  `;
    db_1.default.beginTransaction((transactionError) => {
        if (transactionError) {
            console.error("Error starting transaction:", transactionError);
            res
                .status(500)
                .json({ error: "An error occurred while starting the transaction" });
            return;
        }
        db_1.default.query(query, [id_salon], (queryError, results) => {
            if (queryError) {
                console.error("Error fetching salon:", queryError);
                db_1.default.rollback(() => {
                    res.status(500).json({
                        error: "An error occurred while fetching the salon data",
                    });
                });
                return;
            }
            if (results.length === 0) {
                db_1.default.rollback(() => {
                    res.status(404).json({ message: "Salon not found" });
                });
                return;
            }
            db_1.default.commit((commitError) => {
                if (commitError) {
                    console.error("Error committing transaction:", commitError);
                    db_1.default.rollback(() => {
                        res.status(500).json({
                            error: "An error occurred while committing the transaction",
                        });
                    });
                    return;
                }
                res.json({ data: results[0] });
            });
        });
    });
}));
router.put("/responseReview", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_review, respuesta } = req.body;
    // Verificar que ambos campos estén presentes
    if (!id_review || !respuesta) {
        return res.status(400).json({ error: "Todos los campos son requeridos." });
    }
    try {
        // Iniciar la transacción
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((err) => {
                if (err)
                    return reject(err);
                resolve(undefined);
            });
        });
        // Consulta para actualizar la respuesta
        const query = `
      UPDATE review
      SET respuesta = ?
      WHERE id_review = ?
    `;
        // Ejecutar la consulta
        yield new Promise((resolve, reject) => {
            db_1.default.query(query, [respuesta, id_review], (error, results) => {
                if (error) {
                    console.error("Error al actualizar la respuesta:", error);
                    return db_1.default.rollback(() => {
                        reject(new Error("Error al actualizar la respuesta."));
                    });
                }
                // Hacer commit si la actualización fue exitosa
                db_1.default.commit((err) => {
                    if (err) {
                        console.error("Error al hacer commit:", err);
                        return db_1.default.rollback(() => {
                            reject(new Error("Error al hacer commit."));
                        });
                    }
                    resolve(results);
                });
            });
        });
        // Responder al cliente
        res.json({ message: "Respuesta actualizada exitosamente." });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Ocurrió un error al procesar la solicitud." });
    }
}));
router.put("/updateSalon", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_salon, id_city, plus_code, active, state, in_vacation, name, address, latitud, longitud, email, url, phone, map, iframe, image, about_us, score_old, hours_old, zip_code_old, overview_old, } = req.body;
    if (!id_salon) {
        return res.status(400).json({ error: "id_salon is required" });
    }
    const updateSalonQuery = `
    UPDATE salon
    SET 
      id_city = ?,
      plus_code = ?,
      active = ?,
      state = ?,
      in_vacation = ?,
      name = ?,
      address = ?,
      latitud = ?,
      longitud = ?,
      email = ?,
      url = ?,
      phone = ?,
      map = ?,
      iframe = ?,
      image = ?,
      about_us = ?,
      score_old = ?,
      hours_old = ?,
      zip_code_old = ?,
      overview_old = ?
    WHERE id_salon = ?;
  `;
    try {
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((transactionError) => {
                if (transactionError) {
                    console.error("Error starting transaction:", transactionError);
                    return reject(transactionError);
                }
                db_1.default.query(updateSalonQuery, [
                    id_city,
                    plus_code,
                    active,
                    state,
                    in_vacation,
                    name,
                    address,
                    latitud,
                    longitud,
                    email,
                    url,
                    phone,
                    map,
                    iframe,
                    image,
                    about_us,
                    score_old,
                    hours_old,
                    zip_code_old,
                    overview_old,
                    id_salon,
                ], (queryError) => {
                    if (queryError) {
                        console.error("Error updating salon:", queryError);
                        db_1.default.rollback(() => reject(queryError));
                        return;
                    }
                    // Aquí podrías añadir más lógica, como inserciones de categorías, si es necesario.
                    db_1.default.commit((commitError) => {
                        if (commitError) {
                            console.error("Error committing transaction:", commitError);
                            db_1.default.rollback(() => reject(commitError));
                            return;
                        }
                        resolve();
                    });
                });
            });
        });
        res.json({ message: "Salon updated successfully" });
    }
    catch (error) {
        console.error("Transaction failed:", error);
        res.status(500).json({
            error: "An error occurred while updating the salon.",
        });
    }
}));
router.get("/getProvinces", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `SELECT id_province, name FROM province`;
    db_1.default.query(query, (queryError, results) => {
        if (queryError) {
            console.error("Error fetching provinces:", queryError);
            return res
                .status(500)
                .json({ error: "An error occurred while fetching the provinces" });
        }
        res.json({ data: results });
    });
}));
router.get("/getCitiesByProvince", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id_province = req.query.id_province;
    if (!id_province) {
        return res.status(400).json({ error: "id_province is required" });
    }
    const query = `
    SELECT 
      p.name as province_name,
      c.id_city,
      c.name as city_name,
      c.zip_code
    FROM 
      province p
    JOIN 
      city c ON p.id_province = c.id_province
    WHERE 
      p.id_province = ?;
  `;
    db_1.default.query(query, [id_province], (queryError, results) => {
        if (queryError) {
            console.error("Error fetching cities and province:", queryError);
            return res.status(500).json({
                error: "An error occurred while fetching the city and province data",
            });
        }
        res.json({ data: results });
    });
}));
router.put("/updateSalonHours/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { hours_old } = req.body;
    if (!hours_old) {
        return res.status(400).json({ error: "Missing hours_old field" });
    }
    const query = "UPDATE salon SET hours_old = ?, updated_at = NOW() WHERE id_salon = ?";
    db_1.default.beginTransaction((transactionError) => {
        if (transactionError) {
            console.error("Error starting transaction:", transactionError);
            return res
                .status(500)
                .json({ error: "An error occurred while starting the transaction" });
        }
        db_1.default.query(query, [hours_old, id], (queryError, results) => {
            if (queryError) {
                console.error("Error updating salon hours:", queryError);
                return db_1.default.rollback(() => {
                    res
                        .status(500)
                        .json({ error: "An error occurred while updating salon hours" });
                });
            }
            const result = results;
            if (result.affectedRows === 0) {
                return db_1.default.rollback(() => {
                    res.status(404).json({ error: "Salon not found" });
                });
            }
            db_1.default.commit((commitError) => {
                if (commitError) {
                    console.error("Error committing transaction:", commitError);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            error: "An error occurred while committing the transaction",
                        });
                    });
                }
                res.json({ message: "Salon hours updated successfully" });
            });
        });
    });
}));
router.post("/createSalon", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_city, plus_code, active, state, in_vacation, name, address, latitud, longitud, email, url, phone, map, iframe, image, about_us, score_old, hours_old, zip_code_old, overview_old, categories, } = req.body;
    //console.log("Datos recibidos:", req.body);
    // Verificar si los datos requeridos están presentes
    if (!name || !address || !id_city) {
        console.log("Error: Missing required fields");
        return res
            .status(400)
            .json({ error: "Name, address, and city are required fields" });
    }
    const insertSalonQuery = `
    INSERT INTO salon (
      id_city, plus_code, active, state, in_vacation, name, address, 
      latitud, longitud, email, url, phone, map, iframe, image, about_us, 
      score_old, hours_old, zip_code_old, overview_old
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;
    const insertCategoryQuery = `
    INSERT INTO categories (id_salon, categories) VALUES (?, ?);
  `;
    try {
        yield new Promise((resolve, reject) => {
            console.log("Iniciando transacción...");
            db_1.default.beginTransaction((transactionError) => {
                if (transactionError) {
                    console.error("Error starting transaction:", transactionError);
                    return reject(transactionError);
                }
                console.log("Ejecutando query de inserción de salón...");
                console.log("Query:", insertSalonQuery);
                console.log("Valores:", [
                    id_city,
                    plus_code,
                    active,
                    state,
                    in_vacation,
                    name,
                    address,
                    latitud,
                    longitud,
                    email,
                    url,
                    phone,
                    map,
                    iframe,
                    image,
                    about_us,
                    score_old,
                    hours_old,
                    zip_code_old,
                    overview_old,
                ]);
                db_1.default.query(insertSalonQuery, [
                    id_city,
                    plus_code,
                    active,
                    state,
                    in_vacation,
                    name,
                    address,
                    latitud,
                    longitud,
                    email,
                    url,
                    phone,
                    map,
                    iframe,
                    image,
                    about_us,
                    score_old,
                    hours_old,
                    zip_code_old,
                    overview_old,
                ], (queryError, results) => {
                    if (queryError) {
                        console.error("Error inserting salon:", queryError);
                        db_1.default.rollback(() => reject(queryError));
                        return;
                    }
                    console.log("Salón insertado exitosamente, ID:", results.insertId);
                    // Casting de 'results' para acceder a insertId
                    const newSalonId = results.insertId;
                    const categoryArray = categories
                        .split(";")
                        .map((category) => category.trim());
                    console.log("Categorias a insertar:", categoryArray);
                    const categoryInserts = categoryArray.map((category) => {
                        return new Promise((resolveInsert, rejectInsert) => {
                            console.log(`Insertando categoría: ${category} para el salón ID: ${newSalonId}`);
                            db_1.default.query(insertCategoryQuery, [newSalonId, category], (insertError) => {
                                if (insertError) {
                                    console.error("Error inserting category:", insertError);
                                    return rejectInsert(insertError);
                                }
                                resolveInsert();
                            });
                        });
                    });
                    Promise.all(categoryInserts)
                        .then(() => {
                        console.log("Categorías insertadas exitosamente, confirmando transacción...");
                        db_1.default.commit((commitError) => {
                            if (commitError) {
                                console.error("Error committing transaction:", commitError);
                                db_1.default.rollback(() => reject(commitError));
                                return;
                            }
                            resolve();
                        });
                    })
                        .catch((insertError) => {
                        console.error("Error inserting categories:", insertError);
                        db_1.default.rollback(() => reject(insertError));
                    });
                });
            });
        });
        console.log("Transacción completada exitosamente.");
        res.json({ message: "Salon and categories created successfully" });
    }
    catch (error) {
        console.error("Error final:", error);
        res.status(500).json({
            error: "An error occurred while creating the salon and categories",
        });
    }
}));
router.get("/getServices", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    db_1.default.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        // Usar DISTINCT para seleccionar solo servicios únicos por nombre
        const query = "SELECT DISTINCT id_service, name FROM service";
        db_1.default.query(query, (err, results) => {
            if (err) {
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error fetching services",
                        error: err,
                    });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error committing transaction",
                            error: err,
                        });
                    });
                }
                res.json({ success: true, data: results });
            });
        });
    });
}));
router.get("/getSubservicesByService", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_service } = req.query;
    if (!id_service) {
        return res.status(400).json({ error: "id_service is required" });
    }
    // Consulta SQL ajustada para obtener solo el identificador y el nombre de los subservicios
    const query = `
    SELECT 
      id_service_type, 
      name 
    FROM 
      service_type
    WHERE 
      id_service = ?
  `;
    // Ejecutamos la consulta pasando el id_service como parámetro
    db_1.default.query(query, [id_service], (err, results) => {
        if (err) {
            console.error("Error fetching subservices:", err);
            return res.status(500).json({
                success: false,
                message: "Error fetching subservices",
                error: err,
            });
        }
        res.json({ success: true, data: results });
    });
}));
router.post("/addService", (req, res) => {
    const { id_salon, id_service, id_service_type, time } = req.body;
    console.log("Datos recibidos:", req.body);
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        // Inserta los datos usando los IDs correctos
        const insertServiceQuery = "INSERT INTO salon_service_type (id_salon, id_service, id_service_type, time) VALUES (?, ?, ?, ?)";
        db_1.default.query(insertServiceQuery, [id_salon, id_service, id_service_type, time], (err, result) => {
            if (err) {
                console.error("Error inserting service:", err);
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error inserting service",
                        error: err,
                    });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    console.error("Error committing transaction:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error committing transaction",
                            error: err,
                        });
                    });
                }
                res.json({ success: true, data: result });
            });
        });
    });
});
router.get("/getServicesWithSubservices", (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    const id_salon = req.query.id_salon;
    if (!id_salon) {
        return res.status(400).json({ error: "id_salon is required" });
    }
    const query = `
    SELECT 
      sst.id_salon_service_type,
      sst.id_salon,
      sst.id_service,
      s.name AS service_name,
      sst.id_service_type,
      st.name AS subservice_name,
      sst.time,
      sst.active
    FROM 
      salon_service_type sst
    LEFT JOIN 
      service s ON sst.id_service = s.id_service
    LEFT JOIN 
      service_type st ON sst.id_service_type = st.id_service_type
    WHERE 
      sst.id_salon = ?
    LIMIT ?, ?`;
    const countQuery = "SELECT COUNT(*) AS totalItems FROM salon_service_type WHERE id_salon = ?";
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        db_1.default.query(query, [id_salon, offset, pageSize], (error, results) => {
            if (error) {
                console.error("Error fetching services:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "An error occurred while fetching data" });
                });
            }
            // Cambia el tipo de countResults a any[] para poder indexar el resultado
            db_1.default.query(countQuery, [id_salon], (countError, countResults) => {
                if (countError) {
                    console.error("Error fetching count:", countError);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            error: "An error occurred while fetching data count",
                        });
                    });
                }
                // Asegúrate de acceder correctamente al primer elemento
                const totalItems = countResults[0].totalItems;
                db_1.default.commit((commitErr) => {
                    if (commitErr) {
                        console.error("Error committing transaction:", commitErr);
                        return db_1.default.rollback(() => {
                            res.status(500).json({
                                success: false,
                                message: "Error committing transaction",
                                error: commitErr,
                            });
                        });
                    }
                    res.json({ data: results, totalItems });
                });
            });
        });
    });
});
router.post("/updateReview", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id_review, observacion, qualification } = req.body;
        if (!id_review || !observacion || !qualification) {
            return res
                .status(400)
                .json({ error: "Todos los campos son requeridos." });
        }
        // Validar que `qualification` tenga las propiedades esperadas
        const { service, quality, cleanliness, speed } = qualification;
        if (typeof service !== "number" ||
            typeof quality !== "number" ||
            typeof cleanliness !== "number" ||
            typeof speed !== "number") {
            return res
                .status(400)
                .json({ error: "Los valores de calificación son inválidos." });
        }
        // Función para redondear a medios
        const redondearAMedios = (numero) => {
            return Math.round(numero * 2) / 2;
        };
        // Calcular el promedio de la calificación y redondearlo a medios
        const averageQualification = redondearAMedios((service + quality + cleanliness + speed) / 4);
        // Iniciar la transacción
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((err) => {
                if (err)
                    return reject(err);
                resolve(undefined);
            });
        });
        // Actualizar la reseña en la base de datos con el promedio redondeado
        const query = `
      UPDATE review
      SET observacion = ?, servicio = ?, calidad_precio = ?, limpieza = ?, puntualidad = ?, qualification = ?
      WHERE id_review = ?
    `;
        // Ejecutar la consulta de actualización
        db_1.default.query(query, [
            observacion,
            service,
            quality,
            cleanliness,
            speed,
            averageQualification, // Guardar el promedio calculado y redondeado
            id_review,
        ], (error, results) => {
            if (error) {
                console.error("Error al actualizar la reseña:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Error al actualizar la reseña." });
                });
            }
            // Confirmar la transacción
            db_1.default.commit((err) => {
                if (err) {
                    console.error("Error al hacer commit:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Error al hacer commit." });
                    });
                }
                res.json({ message: "Reseña actualizada exitosamente." });
            });
        });
    }
    catch (err) {
        console.error("Error al actualizar la reseña:", err);
        res.status(500).json({ error: "Error al actualizar la reseña." });
    }
}));
router.put("/updateServiceWithSubservice", (req, res) => {
    let { idSalonServiceType, idService, idServiceType, time, active } = req.body;
    // Validar que idServiceType sea un valor válido y no un objeto vacío
    if (typeof idServiceType !== 'number' || !idServiceType) {
        console.error('idServiceType no es válido:', idServiceType);
        return res.status(400).json({
            success: false,
            message: 'El valor de idServiceType no es válido.',
        });
    }
    // Consulta única para actualizar los datos en la tabla
    const updateQuery = `
    UPDATE salon_service_type
    SET id_service = ?, id_service_type = ?, time = ?, active = ?
    WHERE id_salon_service_type = ?;
  `;
    const queryParams = [idService, idServiceType, time, active, idSalonServiceType];
    // Imprime la consulta y los parámetros para depuración
    console.log("Consulta SQL:", updateQuery);
    console.log("Parámetros:", queryParams);
    // Ejecutar la consulta SQL
    db_1.default.query(updateQuery, queryParams, (err, results) => {
        if (err) {
            console.error("Error updating service:", err);
            // Revisa si hay errores específicos de la base de datos como restricciones de clave foránea
            return res.status(500).json({
                success: false,
                message: "Error updating service",
                error: err,
            });
        }
        // Respuesta exitosa
        res.json({
            success: true,
            message: "Service updated successfully",
            data: results,
        });
    });
});
router.delete("/deleteServiceWithSubservices/:id_salon_service_type", (req, res) => {
    const { id_salon_service_type } = req.params;
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        // Primero, elimina los subservicios asociados al servicio
        const deleteSubservicesQuery = "DELETE FROM salon_service_type WHERE id_salon_service_type = ?";
        db_1.default.query(deleteSubservicesQuery, [id_salon_service_type], (err) => {
            if (err) {
                console.error("Error deleting subservices:", err);
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error deleting subservices",
                        error: err,
                    });
                });
            }
            // Luego, elimina el servicio principal
            const deleteServiceQuery = "DELETE FROM service WHERE id_service = ?";
            db_1.default.query(deleteServiceQuery, [id_salon_service_type], (err) => {
                if (err) {
                    console.error("Error deleting service:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error deleting service",
                            error: err,
                        });
                    });
                }
                // Si todo va bien, confirma la transacción
                db_1.default.commit((err) => {
                    if (err) {
                        console.error("Error committing transaction:", err);
                        return db_1.default.rollback(() => {
                            res.status(500).json({
                                success: false,
                                message: "Error committing transaction",
                                error: err,
                            });
                        });
                    }
                    res.json({
                        success: true,
                        message: "Service and subservices deleted successfully",
                    });
                });
            });
        });
    });
});
router.get("/getFaqByIdSalon", (req, res) => {
    const page = parseInt(req.query.page || "1", 10);
    const pageSize = parseInt(req.query.pageSize || "10", 10);
    const offset = (page - 1) * pageSize;
    const { id_salon } = req.query;
    if (!id_salon) {
        return res
            .status(400)
            .json({ success: false, message: "id_salon is required" });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        const query = `
      SELECT SQL_CALC_FOUND_ROWS * 
      FROM faq 
      WHERE id_salon = ? 
      LIMIT ? OFFSET ?
    `;
        db_1.default.query(query, [id_salon, pageSize, offset], (err, results) => {
            if (err) {
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error fetching FAQ",
                        error: err,
                    });
                });
            }
            // Obtener el número total de filas encontradas
            db_1.default.query("SELECT FOUND_ROWS() as total", (err, totalResults) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error fetching total count",
                            error: err,
                        });
                    });
                }
                db_1.default.commit((err) => {
                    if (err) {
                        return db_1.default.rollback(() => {
                            res.status(500).json({
                                success: false,
                                message: "Error committing transaction",
                                error: err,
                            });
                        });
                    }
                    res.json({
                        success: true,
                        data: results,
                        total: totalResults[0].total, // Devolver el total de resultados
                        page: page,
                        pageSize: pageSize,
                    });
                });
            });
        });
    });
});
router.post("/updateQuestion", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id_faq, answer } = req.body;
        if (!id_faq || !answer) {
            return res
                .status(400)
                .json({ error: "Todos los campos son requeridos." });
        }
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((err) => {
                if (err)
                    return reject(err);
                resolve(undefined);
            });
        });
        const query = `
      UPDATE faq
      SET answer = ?
      WHERE id_faq = ?
    `;
        db_1.default.query(query, [answer, id_faq], (error, results) => {
            if (error) {
                console.error("Error al actualizar la pregunta:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Error al actualizar la pregunta." });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    console.error("Error al hacer commit:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Error al hacer commit." });
                    });
                }
                res.json({ message: "Pregunta actualizada exitosamente." });
            });
        });
    }
    catch (err) {
        console.error("Error al actualizar la pregunta:", err);
        res.status(500).json({ error: "Error al actualizar la pregunta." });
    }
}));
router.post("/deleteQuestion", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id_faq } = req.body;
        if (!id_faq) {
            return res
                .status(400)
                .json({ error: "El parámetro 'id_faq' es requerido." });
        }
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((err) => {
                if (err)
                    return reject(err);
                resolve(undefined);
            });
        });
        const query = `DELETE FROM faq WHERE id_faq = ?`;
        db_1.default.query(query, [id_faq], (error, results) => {
            if (error) {
                console.error("Error al eliminar la pregunta:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Error al eliminar la pregunta." });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    console.error("Error al hacer commit:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Error al hacer commit." });
                    });
                }
                res.json({ message: "Pregunta eliminada exitosamente." });
            });
        });
    }
    catch (err) {
        console.error("Error al eliminar la pregunta:", err);
        res.status(500).json({ error: "Error al eliminar la pregunta." });
    }
}));
router.get("/loadReview", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id_salon } = req.query;
        if (!id_salon) {
            return res.status(400).json({ error: "id_salon no encontrado" });
        }
        // Iniciar la transacción
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((err) => {
                if (err)
                    return reject(err);
                resolve(undefined);
            });
        });
        const query = `SELECT 
    review.id_review, 
    review.id_user,
    review.respuesta, 
    review.observacion, 
    review.qualification,
    user.name
  FROM 
    review
  INNER JOIN 
    user 
  ON 
    review.id_user = user.id_user
  WHERE 
    review.id_salon = ?`;
        db_1.default.query(query, [id_salon], (error, results) => {
            if (error) {
                console.error("Error al buscar el servicio:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Error al buscar el servicio." });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    console.error("Error al hacer commit:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Error al buscar el servicio." });
                    });
                }
                res.json(results);
            });
        });
    }
    catch (err) {
        console.error("Error al buscar el servicio:", err);
        res.status(500).json({ error: "Error al buscar el servicio." });
    }
}));
router.post("/updateReview", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id_review, id_user, observacion, qualification } = req.body;
        if (!id_review || !id_user || !observacion || !qualification) {
            return res.status(400).json({ error: "Todos los campos son requeridos." });
        }
        // Iniciar la transacción
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((err) => {
                if (err)
                    return reject(err);
                resolve(undefined);
            });
        });
        // Actualizar la reseña sin modificar el id_salon
        const query = `
      UPDATE review
      SET id_user = ?, observacion = ?, qualification = ?
      WHERE id_review = ?
    `;
        db_1.default.query(query, [id_user, observacion, qualification, id_review], (error, results) => {
            if (error) {
                console.error("Error al actualizar la reseña:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Error al actualizar la reseña." });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    console.error("Error al hacer commit:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Error al hacer commit." });
                    });
                }
                res.json({ message: "Reseña actualizada exitosamente." });
            });
        });
    }
    catch (err) {
        console.error("Error al actualizar la reseña:", err);
        res.status(500).json({ error: "Error al actualizar la reseña." });
    }
}));
router.post("/deleteReview", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id_review } = req.body;
        if (!id_review) {
            return res.status(400).json({ error: "El parámetro 'id_review' es requerido." });
        }
        // Iniciar la transacción
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((err) => {
                if (err)
                    return reject(err);
                resolve(undefined);
            });
        });
        // Eliminar la reseña
        const query = `DELETE FROM review WHERE id_review = ?`;
        db_1.default.query(query, [id_review], (error, results) => {
            if (error) {
                console.error("Error al eliminar la reseña:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Error al eliminar la reseña." });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    console.error("Error al hacer commit:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Error al hacer commit." });
                    });
                }
                res.json({ message: "Reseña eliminada exitosamente." });
            });
        });
    }
    catch (err) {
        console.error("Error al eliminar la reseña:", err);
        res.status(500).json({ error: "Error al eliminar la reseña." });
    }
}));
router.get("/getAllCategoriesSalon", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `
      SELECT DISTINCT categories
      FROM categories
  `;
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error iniciando la transacción:", err);
            return res.status(500).json({ error: "Error al iniciar la transacción" });
        }
        // Ejecutar la consulta SQL
        db_1.default.query(query, (error, results) => {
            if (error) {
                console.error("Error al obtener las categorías:", error);
                // Revertir la transacción en caso de error
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Error al obtener las categorías" });
                });
            }
            // Procesar los resultados
            const processedResults = results.map((row) => ({
                category: row.categories,
            }));
            // Confirmar la transacción
            db_1.default.commit((commitError) => {
                if (commitError) {
                    console.error("Error al confirmar la transacción:", commitError);
                    // Revertir la transacción en caso de error al confirmar
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Error al confirmar la transacción" });
                    });
                }
                // Enviar la respuesta exitosa
                res.json({ data: processedResults });
            });
        });
    });
}));
router.post('/addCategorySalon', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_salon, category } = req.body;
    // Validar que los campos requeridos estén presentes
    if (!id_salon || !category) {
        return res.status(400).json({ error: 'id_salon y category son requeridos.' });
    }
    // Consulta para insertar la nueva categoría
    const insertCategoryQuery = `
    INSERT INTO categories (id_salon, categories)
    VALUES (?, ?);
  `;
    try {
        // Iniciar transacción
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((transactionError) => {
                if (transactionError) {
                    console.error('Error al iniciar la transacción:', transactionError);
                    return reject(transactionError);
                }
                // Ejecutar la consulta para insertar la categoría
                db_1.default.query(insertCategoryQuery, [id_salon, category], (queryError) => {
                    if (queryError) {
                        console.error('Error al insertar la categoría:', queryError);
                        db_1.default.rollback(() => reject(queryError));
                        return;
                    }
                    // Commit de la transacción
                    db_1.default.commit((commitError) => {
                        if (commitError) {
                            console.error('Error al hacer commit de la transacción:', commitError);
                            db_1.default.rollback(() => reject(commitError));
                            return;
                        }
                        resolve(null);
                    });
                });
            });
        });
        // Respuesta de éxito
        res.json({ message: 'Categoría añadida correctamente.' });
    }
    catch (error) {
        console.error('Error en la transacción:', error);
        res.status(500).json({ error: 'Ocurrió un error al añadir la categoría.' });
    }
}));
router.put('/updateCategorySalon', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_category, categories } = req.body;
    //console.log('id_category:', id_category);
    //console.log('categories:', categories);
    // Validar que los campos requeridos estén presentes
    if (!id_category || !categories) {
        return res.status(400).json({ error: 'id_category y categories son requeridos.' });
    }
    // Consulta SQL para actualizar la categoría
    const updateCategoryQuery = `
    UPDATE categories
    SET categories = ?
    WHERE id_category = ?;
  `;
    // Forzar el tipo de resultado a ResultSetHeader
    db_1.default.query(updateCategoryQuery, [categories, id_category], (error, results) => {
        if (error) {
            console.error('Error al actualizar la categoría:', error);
            return res.status(500).json({ error: 'Error al actualizar la categoría.' });
        }
        //console.log('Resultados de la consulta:', results);
        // Acceder a affectedRows desde ResultSetHeader
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada o no se pudo actualizar.' });
        }
        res.json({ message: 'Categoría actualizada correctamente.' });
    });
}));
router.delete('/deleteCategotySalon/:id_category', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_category } = req.params;
    // Verificar si id_category es válido
    if (!id_category) {
        return res.status(400).json({ message: 'ID de categoría no proporcionado' });
    }
    // Consulta SQL para eliminar la categoría
    const deleteQuery = 'DELETE FROM categories WHERE id_category = ?';
    // Ejecutar la consulta
    db_1.default.query(deleteQuery, [id_category], (err, result) => {
        if (err) {
            console.error('Error al eliminar la categoría:', err);
            return res.status(500).json({ message: 'Error al eliminar la categoría' });
        }
        // Convertir result a OkPacket para poder acceder a affectedRows
        const okResult = result;
        // Verificar si se eliminó alguna fila comprobando affectedRows
        if (okResult.affectedRows > 0) {
            return res.status(200).json({ message: 'Categoría eliminada exitosamente' });
        }
        else {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }
    });
}));
exports.default = router;
