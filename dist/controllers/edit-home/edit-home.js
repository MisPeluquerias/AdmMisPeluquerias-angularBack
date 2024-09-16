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
    GROUP_CONCAT(TRIM(REPLACE(c.categories, '; ', '')) SEPARATOR '; ') AS categories,
    ci.name as city_name,
    ci.zip_code as city_zip_code,
    p.id_province,
    p.name as province_name
  FROM 
    salon s
  LEFT JOIN 
    categories c ON s.id_salon = c.id_salon
  LEFT JOIN
    city ci ON s.id_city = ci.id_city
  LEFT JOIN
    province p ON ci.id_province = p.id_province
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
router.put("/updateSalon", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_salon, id_city, plus_code, active, state, in_vacation, name, address, latitud, longitud, email, url, phone, map, iframe, image, about_us, score_old, hours_old, zip_code_old, overview_old, categories, } = req.body;
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
    const deleteCategoriesQuery = `
    DELETE FROM categories WHERE id_salon = ?;
  `;
    const insertCategoryQuery = `
    INSERT INTO categories (id_salon, categories) VALUES (?, ?);
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
                    db_1.default.query(deleteCategoriesQuery, [id_salon], (deleteError) => {
                        if (deleteError) {
                            console.error("Error deleting categories:", deleteError);
                            db_1.default.rollback(() => reject(deleteError));
                            return;
                        }
                        if (categories && categories.trim() !== "") {
                            const categoryArray = categories
                                .split(";")
                                .map((category) => category.trim());
                            const categoryInserts = categoryArray.map((category) => {
                                return new Promise((resolveInsert, rejectInsert) => {
                                    db_1.default.query(insertCategoryQuery, [id_salon, category], (insertError) => {
                                        if (insertError) {
                                            return rejectInsert(insertError);
                                        }
                                        resolveInsert();
                                    });
                                });
                            });
                            Promise.all(categoryInserts)
                                .then(() => {
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
                        }
                        else {
                            // Si no hay categorías, simplemente se hace commit
                            db_1.default.commit((commitError) => {
                                if (commitError) {
                                    console.error("Error committing transaction:", commitError);
                                    db_1.default.rollback(() => reject(commitError));
                                    return;
                                }
                                resolve();
                            });
                        }
                    });
                });
            });
        });
        res.json({ message: "Salon updated successfully" });
    }
    catch (error) {
        res.status(500).json({
            error: "An error occurred while updating the salon and categories",
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
router.get("/getServices", (req, res) => {
    db_1.default.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        // Usar DISTINCT para seleccionar solo servicios únicos por nombre
        const query = "SELECT DISTINCT name FROM service";
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
});
router.post("/addService", (req, res) => {
    const { id_salon, name, subservices, time } = req.body;
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        const insertServiceQuery = "INSERT INTO service (id_salon, name, time) VALUES (?, ?, ?)";
        db_1.default.query(insertServiceQuery, [id_salon, name, time], (err, results) => {
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
            const service_id = results.insertId;
            if (subservices && subservices.length > 0) {
                const subserviceValues = subservices.map((subservice) => [
                    service_id,
                    subservice,
                ]);
                const insertSubserviceQuery = "INSERT INTO service_type (id_service, name) VALUES ?";
                db_1.default.query(insertSubserviceQuery, [subserviceValues], (err) => {
                    if (err) {
                        console.error("Error inserting subservices:", err);
                        return db_1.default.rollback(() => {
                            res.status(500).json({
                                success: false,
                                message: "Error inserting subservices",
                                error: err,
                            });
                        });
                    }
                    const getServiceQuery = `
            SELECT s.name AS service_name, s.time, GROUP_CONCAT(st.name ORDER BY st.name SEPARATOR '; ') AS subservices
            FROM service s
            INNER JOIN service_type st ON s.id_service = st.id_service
            WHERE s.id_service = ?
            GROUP BY s.name, s.time
          `;
                    db_1.default.query(getServiceQuery, [service_id], (err, result) => {
                        if (err) {
                            console.error("Error fetching service with subservices:", err);
                            return db_1.default.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    message: "Error fetching service with subservices",
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
            }
            else {
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
                    res.json({ success: true, data: { name, time, subservices: "" } });
                });
            }
        });
    });
});
router.get("/getServicesWithSubservices", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || "1", 10);
    const pageSize = parseInt(req.query.pageSize || "10", 10);
    const offset = (page - 1) * pageSize;
    const id_salon = req.query.id_salon;
    if (!id_salon) {
        return res.status(400).json({ error: "id_salon is required" });
    }
    const query = `
    SELECT SQL_CALC_FOUND_ROWS 
      s.id_service,
      s.name AS service_name, 
      s.time, 
      GROUP_CONCAT(DISTINCT st.name ORDER BY st.name SEPARATOR '; ') AS subservices
    FROM 
      service s
    LEFT JOIN 
      service_type st ON s.id_service = st.id_service
    WHERE 
      s.id_salon = ?
    GROUP BY 
      s.id_service, s.name, s.time
    ORDER BY 
      s.name
    LIMIT ?, ?`;
    const countQuery = "SELECT FOUND_ROWS() AS totalItems";
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
                    res
                        .status(500)
                        .json({ error: "An error occurred while fetching data" });
                });
            }
            db_1.default.query(countQuery, (countError, countResults) => {
                if (countError) {
                    console.error("Error fetching count:", countError);
                    return db_1.default.rollback(() => {
                        res
                            .status(500)
                            .json({ error: "An error occurred while fetching data count" });
                    });
                }
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
}));
router.put("/updateServiceWithSubservice", (req, res) => {
    const { id_service, id_salon, name, subservices, time } = req.body;
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        const updateServiceQuery = "UPDATE service SET name = ?, time = ? WHERE id_service = ? AND id_salon = ?";
        db_1.default.query(updateServiceQuery, [name, time, id_service, id_salon], (err, results) => {
            if (err) {
                console.error("Error updating service:", err);
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error updating service",
                        error: err,
                    });
                });
            }
            const deleteSubservicesQuery = "DELETE FROM service_type WHERE id_service = ?";
            db_1.default.query(deleteSubservicesQuery, [id_service], (err) => {
                if (err) {
                    console.error("Error deleting old subservices:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error deleting old subservices",
                            error: err,
                        });
                    });
                }
                if (subservices && subservices.length > 0) {
                    const subserviceValues = subservices.map((subservice) => [
                        id_service,
                        subservice,
                    ]);
                    const insertSubserviceQuery = "INSERT INTO service_type (id_service, name) VALUES ?";
                    db_1.default.query(insertSubserviceQuery, [subserviceValues], (err) => {
                        if (err) {
                            console.error("Error inserting new subservices:", err);
                            return db_1.default.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    message: "Error inserting new subservices",
                                    error: err,
                                });
                            });
                        }
                        const getServiceQuery = `
              SELECT s.name AS service_name, s.time, GROUP_CONCAT(st.name ORDER BY st.name SEPARATOR '; ') AS subservices
              FROM service s
              INNER JOIN service_type st ON s.id_service = st.id_service
              WHERE s.id_service = ?
              GROUP BY s.name, s.time
            `;
                        db_1.default.query(getServiceQuery, [id_service], (err, result) => {
                            if (err) {
                                console.error("Error fetching updated service with subservices:", err);
                                return db_1.default.rollback(() => {
                                    res.status(500).json({
                                        success: false,
                                        message: "Error fetching updated service with subservices",
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
                }
                else {
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
                            data: { name, time, subservices: "" },
                        });
                    });
                }
            });
        });
    });
});
router.delete("/deleteServiceWithSubservices/:id_service", (req, res) => {
    const { id_service } = req.params;
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
        const deleteSubservicesQuery = "DELETE FROM service_type WHERE id_service = ?";
        db_1.default.query(deleteSubservicesQuery, [id_service], (err) => {
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
            db_1.default.query(deleteServiceQuery, [id_service], (err) => {
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
exports.default = router;
