import express from "express";
import connection from "../../db/db";
import bodyParser from "body-parser";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { Request, Response } from "express";
import mysql from "mysql2";
const { ResultSetHeader } = require("mysql2");
import { OkPacket } from "mysql2";

const router = express.Router();
router.use(bodyParser.json());

router.get("/getSalonById", async (req: Request, res: Response) => {
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

  connection.beginTransaction((transactionError) => {
    if (transactionError) {
      console.error("Error starting transaction:", transactionError);
      res
        .status(500)
        .json({ error: "An error occurred while starting the transaction" });
      return;
    }

    connection.query(
      query,
      [id_salon],
      (queryError, results: RowDataPacket[]) => {
        if (queryError) {
          console.error("Error fetching salon:", queryError);
          connection.rollback(() => {
            res.status(500).json({
              error: "An error occurred while fetching the salon data",
            });
          });
          return;
        }

        if (results.length === 0) {
          connection.rollback(() => {
            res.status(404).json({ message: "Salon not found" });
          });
          return;
        }

        connection.commit((commitError) => {
          if (commitError) {
            console.error("Error committing transaction:", commitError);
            connection.rollback(() => {
              res.status(500).json({
                error: "An error occurred while committing the transaction",
              });
            });
            return;
          }

          res.json({ data: results[0] });
        });
      }
    );
  });
});

router.put("/responseReview", async (req: Request, res: Response) => {
  const { id_review, respuesta } = req.body;

  // Verificar que ambos campos estén presentes
  if (!id_review) {
    return res.status(400).json({ error: "Todos los campos son requeridos." });
  }

  try {
    // Iniciar la transacción
    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
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
    await new Promise((resolve, reject) => {
      connection.query(query, [respuesta, id_review], (error, results) => {
        if (error) {
          console.error("Error al actualizar la respuesta:", error);
          return connection.rollback(() => {
            reject(new Error("Error al actualizar la respuesta."));
          });
        }

        // Hacer commit si la actualización fue exitosa
        connection.commit((err) => {
          if (err) {
            console.error("Error al hacer commit:", err);
            return connection.rollback(() => {
              reject(new Error("Error al hacer commit."));
            });
          }

          resolve(results);
        });
      });
    });

    // Responder al cliente
    res.json({ message: "Respuesta actualizada exitosamente." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Ocurrió un error al procesar la solicitud." });
  }
});

router.put("/updateSalon", async (req: Request, res: Response) => {
  const {
    id_salon,
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
  } = req.body;

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
    await new Promise<void>((resolve, reject) => {
      connection.beginTransaction((transactionError) => {
        if (transactionError) {
          console.error("Error starting transaction:", transactionError);
          return reject(transactionError);
        }

        connection.query(
          updateSalonQuery,
          [
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
          ],
          (queryError) => {
            if (queryError) {
              console.error("Error updating salon:", queryError);
              connection.rollback(() => reject(queryError));
              return;
            }

            // Aquí podrías añadir más lógica, como inserciones de categorías, si es necesario.
            connection.commit((commitError) => {
              if (commitError) {
                console.error("Error committing transaction:", commitError);
                connection.rollback(() => reject(commitError));
                return;
              }
              resolve();
            });
          }
        );
      });
    });

    res.json({ message: "Salon updated successfully" });
  } catch (error) {
    console.error("Transaction failed:", error);
    res.status(500).json({
      error: "An error occurred while updating the salon.",
    });
  }
});

router.get("/getProvinces", async (req: Request, res: Response) => {
  const query = `SELECT id_province, name FROM province`;

  connection.query(query, (queryError, results: RowDataPacket[]) => {
    if (queryError) {
      console.error("Error fetching provinces:", queryError);
      return res
        .status(500)
        .json({ error: "An error occurred while fetching the provinces" });
    }

    res.json({ data: results });
  });
});

router.get("/getCitiesByProvince", async (req: Request, res: Response) => {
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

  connection.query(
    query,
    [id_province],
    (queryError, results: RowDataPacket[]) => {
      if (queryError) {
        console.error("Error fetching cities and province:", queryError);
        return res.status(500).json({
          error: "An error occurred while fetching the city and province data",
        });
      }

      res.json({ data: results });
    }
  );
});

router.put("/updateSalonHours/:id", async (req, res) => {
  const { id } = req.params;
  const { hours_old } = req.body;

  if (!hours_old) {
    return res.status(400).json({ error: "Missing hours_old field" });
  }

  const query =
    "UPDATE salon SET hours_old = ?, updated_at = NOW() WHERE id_salon = ?";

  connection.beginTransaction((transactionError) => {
    if (transactionError) {
      console.error("Error starting transaction:", transactionError);
      return res
        .status(500)
        .json({ error: "An error occurred while starting the transaction" });
    }

    connection.query(query, [hours_old, id], (queryError, results) => {
      if (queryError) {
        console.error("Error updating salon hours:", queryError);
        return connection.rollback(() => {
          res
            .status(500)
            .json({ error: "An error occurred while updating salon hours" });
        });
      }

      const result: any = results;
      if (result.affectedRows === 0) {
        return connection.rollback(() => {
          res.status(404).json({ error: "Salon not found" });
        });
      }

      connection.commit((commitError) => {
        if (commitError) {
          console.error("Error committing transaction:", commitError);
          return connection.rollback(() => {
            res.status(500).json({
              error: "An error occurred while committing the transaction",
            });
          });
        }

        res.json({ message: "Salon hours updated successfully" });
      });
    });
  });
});

router.post("/createSalon", async (req: Request, res: Response) => {
  const {
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
    categories,
  } = req.body;

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
    await new Promise<void>((resolve, reject) => {
      console.log("Iniciando transacción...");

      connection.beginTransaction((transactionError) => {
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

        connection.query(
          insertSalonQuery,
          [
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
          ],
          (queryError, results) => {
            if (queryError) {
              console.error("Error inserting salon:", queryError);
              connection.rollback(() => reject(queryError));
              return;
            }

            console.log(
              "Salón insertado exitosamente, ID:",
              (results as mysql.OkPacket).insertId
            );

            // Casting de 'results' para acceder a insertId
            const newSalonId = (results as mysql.OkPacket).insertId;

            const categoryArray: string[] = categories
              .split(";")
              .map((category: string) => category.trim());

            console.log("Categorias a insertar:", categoryArray);

            const categoryInserts = categoryArray.map((category: string) => {
              return new Promise<void>((resolveInsert, rejectInsert) => {
                console.log(
                  `Insertando categoría: ${category} para el salón ID: ${newSalonId}`
                );
                connection.query(
                  insertCategoryQuery,
                  [newSalonId, category],
                  (insertError) => {
                    if (insertError) {
                      console.error("Error inserting category:", insertError);
                      return rejectInsert(insertError);
                    }
                    resolveInsert();
                  }
                );
              });
            });

            Promise.all(categoryInserts)
              .then(() => {
                console.log(
                  "Categorías insertadas exitosamente, confirmando transacción..."
                );
                connection.commit((commitError) => {
                  if (commitError) {
                    console.error("Error committing transaction:", commitError);
                    connection.rollback(() => reject(commitError));
                    return;
                  }

                  resolve();
                });
              })
              .catch((insertError) => {
                console.error("Error inserting categories:", insertError);
                connection.rollback(() => reject(insertError));
              });
          }
        );
      });
    });

    console.log("Transacción completada exitosamente.");
    res.json({ message: "Salon and categories created successfully" });
  } catch (error) {
    console.error("Error final:", error);
    res.status(500).json({
      error: "An error occurred while creating the salon and categories",
    });
  }
});

router.get("/getServices", async (req, res) => {
  connection.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error starting transaction",
        error: err,
      });
    }

    // Usar DISTINCT para seleccionar solo servicios únicos por nombre
    const query = "SELECT DISTINCT id_service, name FROM service";

    connection.query(query, (err, results) => {
      if (err) {
        return connection.rollback(() => {
          res.status(500).json({
            success: false,
            message: "Error fetching services",
            error: err,
          });
        });
      }

      connection.commit((err) => {
        if (err) {
          return connection.rollback(() => {
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

router.get("/getAllBrands", async (req, res) => {
  connection.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error starting transaction",
        error: err,
      });
    }

    // Usar DISTINCT para seleccionar solo servicios únicos por nombre
    const query = "SELECT * FROM brands";

    connection.query(query, (err, results) => {
      if (err) {
        return connection.rollback(() => {
          res.status(500).json({
            success: false,
            message: "Error fetching brands",
            error: err,
          });
        });
      }

      connection.commit((err) => {
        if (err) {
          return connection.rollback(() => {
            res.status(500).json({
              success: false,
              message: "Error committing transaction",
              error: err,
            });
          });
        }
        res.json(results);
      });
    });
  });
});

router.get("/getBrandsBySalon", (req, res) => {
  const id_salon = req.query.id_salon;

  // Validar que el id_salon está presente
  if (!id_salon) {
    return res.status(400).json({
      success: false,
      message: "El id_salon es requerido",
    });
  }

  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error starting transaction:", err);
      return res.status(500).json({
        success: false,
        message: "Error starting transaction",
        error: err,
      });
    }

    const query = `
      SELECT bs.id_brand_salon, bs.id_salon, bs.id_brand, b.name, b.imagePath 
      FROM brands_salon bs
      INNER JOIN brands b ON bs.id_brand = b.id_brand
      WHERE bs.id_salon = ?`;

    connection.query(query, [id_salon], (err, results) => {
      if (err) {
        console.error("Error fetching brands:", err);
        return connection.rollback(() => {
          res.status(500).json({
            success: false,
            message: "Error fetching brands",
            error: err,
          });
        });
      }

      connection.commit((err) => {
        if (err) {
          console.error("Error committing transaction:", err);
          return connection.rollback(() => {
            res.status(500).json({
              success: false,
              message: "Error committing transaction",
              error: err,
            });
          });
        }

        // Si todo sale bien, devolver los resultados
        res.json(results);
      });
    });
  });
});

router.get("/getSubservicesByService", async (req, res) => {
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
  connection.query(query, [id_service], (err, results) => {
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
});

router.post("/addService", (req, res) => {
  const { id_salon, id_service, id_service_type, time } = req.body;
  console.log("Datos recibidos:", req.body);

  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error starting transaction:", err);
      return res.status(500).json({
        success: false,
        message: "Error starting transaction",
        error: err,
      });
    }

    // Inserta los datos usando los IDs correctos
    const insertServiceQuery =
      "INSERT INTO salon_service_type (id_salon, id_service, id_service_type, time) VALUES (?, ?, ?, ?)";

    connection.query(
      insertServiceQuery,
      [id_salon, id_service, id_service_type, time],
      (err, result) => {
        if (err) {
          console.error("Error inserting service:", err);
          return connection.rollback(() => {
            res.status(500).json({
              success: false,
              message: "Error inserting service",
              error: err,
            });
          });
        }

        connection.commit((err) => {
          if (err) {
            console.error("Error committing transaction:", err);
            return connection.rollback(() => {
              res.status(500).json({
                success: false,
                message: "Error committing transaction",
                error: err,
              });
            });
          }

          res.json({ success: true, data: result });
        });
      }
    );
  });
});

router.get("/getServicesWithSubservices", (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;
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

  const countQuery =
    "SELECT COUNT(*) AS totalItems FROM salon_service_type WHERE id_salon = ?";

  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error starting transaction:", err);
      return res.status(500).json({
        success: false,
        message: "Error starting transaction",
        error: err,
      });
    }

    connection.query(query, [id_salon, offset, pageSize], (error, results) => {
      if (error) {
        console.error("Error fetching services:", error);
        return connection.rollback(() => {
          res
            .status(500)
            .json({ error: "An error occurred while fetching data" });
        });
      }

      // Cambia el tipo de countResults a any[] para poder indexar el resultado
      connection.query(
        countQuery,
        [id_salon],
        (countError, countResults: any[]) => {
          if (countError) {
            console.error("Error fetching count:", countError);
            return connection.rollback(() => {
              res.status(500).json({
                error: "An error occurred while fetching data count",
              });
            });
          }

          // Asegúrate de acceder correctamente al primer elemento
          const totalItems = countResults[0].totalItems;

          connection.commit((commitErr) => {
            if (commitErr) {
              console.error("Error committing transaction:", commitErr);
              return connection.rollback(() => {
                res.status(500).json({
                  success: false,
                  message: "Error committing transaction",
                  error: commitErr,
                });
              });
            }

            res.json({ data: results, totalItems });
          });
        }
      );
    });
  });
});

router.post("/updateReview", async (req, res) => {
  try {
    const { id_review, observacion, qualification } = req.body;
    if (!id_review || !observacion || !qualification) {
      return res
        .status(400)
        .json({ error: "Todos los campos son requeridos." });
    }

    // Validar que `qualification` tenga las propiedades esperadas
    const { service, quality, cleanliness, speed } = qualification;
    if (
      typeof service !== "number" ||
      typeof quality !== "number" ||
      typeof cleanliness !== "number" ||
      typeof speed !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "Los valores de calificación son inválidos." });
    }

    // Función para redondear a medios
    const redondearAMedios = (numero: number) => {
      return Math.round(numero * 2) / 2;
    };

    // Calcular el promedio de la calificación y redondearlo a medios
    const averageQualification = redondearAMedios(
      (service + quality + cleanliness + speed) / 4
    );

    // Iniciar la transacción
    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
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
    connection.query(
      query,
      [
        observacion,
        service,
        quality,
        cleanliness,
        speed,
        averageQualification, // Guardar el promedio calculado y redondeado
        id_review,
      ],
      (error, results) => {
        if (error) {
          console.error("Error al actualizar la reseña:", error);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al actualizar la reseña." });
          });
        }

        // Confirmar la transacción
        connection.commit((err) => {
          if (err) {
            console.error("Error al hacer commit:", err);
            return connection.rollback(() => {
              res.status(500).json({ error: "Error al hacer commit." });
            });
          }

          res.json({ message: "Reseña actualizada exitosamente." });
        });
      }
    );
  } catch (err) {
    console.error("Error al actualizar la reseña:", err);
    res.status(500).json({ error: "Error al actualizar la reseña." });
  }
});

router.put("/updateServiceWithSubservice", (req, res) => {
  let { idSalonServiceType, idService, idServiceType, time, active } = req.body;

  // Validar que idServiceType sea un valor válido y no un objeto vacío
  if (typeof idServiceType !== "number" || !idServiceType) {
    console.error("idServiceType no es válido:", idServiceType);
    return res.status(400).json({
      success: false,
      message: "El valor de idServiceType no es válido.",
    });
  }

  // Consulta única para actualizar los datos en la tabla
  const updateQuery = `
    UPDATE salon_service_type
    SET id_service = ?, id_service_type = ?, time = ?, active = ?
    WHERE id_salon_service_type = ?;
  `;

  const queryParams = [
    idService,
    idServiceType,
    time,
    active,
    idSalonServiceType,
  ];

  // Imprime la consulta y los parámetros para depuración
  console.log("Consulta SQL:", updateQuery);
  console.log("Parámetros:", queryParams);

  // Ejecutar la consulta SQL
  connection.query(updateQuery, queryParams, (err, results) => {
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

router.delete(
  "/deleteServiceWithSubservices/:id_salon_service_type",
  (req, res) => {
    const { id_salon_service_type } = req.params;

    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error starting transaction:", err);
        return res.status(500).json({
          success: false,
          message: "Error starting transaction",
          error: err,
        });
      }

      // Primero, elimina los subservicios asociados al servicio
      const deleteSubservicesQuery =
        "DELETE FROM salon_service_type WHERE id_salon_service_type = ?";
      connection.query(
        deleteSubservicesQuery,
        [id_salon_service_type],
        (err) => {
          if (err) {
            console.error("Error deleting subservices:", err);
            return connection.rollback(() => {
              res.status(500).json({
                success: false,
                message: "Error deleting subservices",
                error: err,
              });
            });
          }

          // Luego, elimina el servicio principal
          const deleteServiceQuery = "DELETE FROM service WHERE id_service = ?";
          connection.query(
            deleteServiceQuery,
            [id_salon_service_type],
            (err) => {
              if (err) {
                console.error("Error deleting service:", err);
                return connection.rollback(() => {
                  res.status(500).json({
                    success: false,
                    message: "Error deleting service",
                    error: err,
                  });
                });
              }

              // Si todo va bien, confirma la transacción
              connection.commit((err) => {
                if (err) {
                  console.error("Error committing transaction:", err);
                  return connection.rollback(() => {
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
            }
          );
        }
      );
    });
  }
);

router.get("/getFaqByIdSalon", (req, res) => {
  const page = parseInt((req.query.page as string) || "1", 10);
  const pageSize = parseInt((req.query.pageSize as string) || "10", 10);
  const offset = (page - 1) * pageSize;

  const { id_salon } = req.query;

  if (!id_salon) {
    return res
      .status(400)
      .json({ success: false, message: "id_salon is required" });
  }

  connection.beginTransaction((err) => {
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

    connection.query(
      query,
      [id_salon, pageSize, offset],
      (err, results: RowDataPacket[]) => {
        if (err) {
          return connection.rollback(() => {
            res.status(500).json({
              success: false,
              message: "Error fetching FAQ",
              error: err,
            });
          });
        }

        // Obtener el número total de filas encontradas
        connection.query(
          "SELECT FOUND_ROWS() as total",
          (err, totalResults: RowDataPacket[]) => {
            if (err) {
              return connection.rollback(() => {
                res.status(500).json({
                  success: false,
                  message: "Error fetching total count",
                  error: err,
                });
              });
            }

            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
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
          }
        );
      }
    );
  });
});

router.put("/updateQuestion", async (req, res) => {
  try {
    const { id_faq, answer } = req.body;
    console.log("Respuesta modificada recibida:", answer);

    if (!id_faq) {
      console.log("Error: Falta el parámetro 'id_faq'");
      return res.status(400).json({ error: "Falta el parámetro 'id_faq'" });
    }

    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });

    const query = `
      UPDATE faq
      SET answer = ?
      WHERE id_faq = ?
    `;

    connection.query(query, [answer, id_faq], (error, results) => {
      if (error) {
        console.error("Error al actualizar la pregunta:", error);
        return connection.rollback(() => {
          res.status(500).json({ error: "Error al actualizar la pregunta." });
        });
      }

      connection.commit((err) => {
        if (err) {
          console.error("Error al hacer commit:", err);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al hacer commit." });
          });
        }

        res.json({ message: "Pregunta actualizada exitosamente." });
      });
    });
  } catch (err) {
    console.error("Error al actualizar la pregunta:", err);
    res.status(500).json({ error: "Error al actualizar la pregunta." });
  }
});


router.put("/UpdateBrandById", async (req, res) => {
  try {
    const { id_brand_salon, id_brand } = req.body;

    console.log("Id recibido:", id_brand_salon);
    console.log("Id de marca recibido",id_brand);

    if (!id_brand ||!id_brand_salon) {
      console.log("Error: Falta el parámetro 'id_brand'");
      return res.status(400).json({ error: "Falta el parámetro 'id_brand'" });
    }

    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });

    const query = `
      UPDATE brands_salon
      SET id_brand = ?
      WHERE id_brand_salon = ?
    `;

    connection.query(query, [id_brand, id_brand_salon], (error, results) => {
      if (error) {
        console.error("Error al actualizar la marca:", error);
        return connection.rollback(() => {
          res.status(500).json({ error: "Error al actualizar la marca." });
        });
      }
      connection.commit((err) => {
        if (err) {
          console.error("Error al hacer commit:", err);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al hacer commit." });
          });
        }

        res.json({ message: "Marca actualizada exitosamente." });
      });
    });
  } catch (err) {
    console.error("Error al actualizar la pregunta:", err);
    res.status(500).json({ error: "Error al actualizar la marca." });
  }
});




router.post("/deleteQuestion", async (req, res) => {
  try {
    const { id_faq } = req.body;

    if (!id_faq) {
      return res
        .status(400)
        .json({ error: "El parámetro 'id_faq' es requerido." });
    }

    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });

    const query = `DELETE FROM faq WHERE id_faq = ?`;

    connection.query(query, [id_faq], (error, results) => {
      if (error) {
        console.error("Error al eliminar la pregunta:", error);
        return connection.rollback(() => {
          res.status(500).json({ error: "Error al eliminar la pregunta." });
        });
      }

      connection.commit((err) => {
        if (err) {
          console.error("Error al hacer commit:", err);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al hacer commit." });
          });
        }

        res.json({ message: "Pregunta eliminada exitosamente." });
      });
    });
  } catch (err) {
    console.error("Error al eliminar la pregunta:", err);
    res.status(500).json({ error: "Error al eliminar la pregunta." });
  }
});

router.get("/loadReview", async (req, res) => {
  try {
    const { id_salon } = req.query;

    if (!id_salon) {
      return res.status(400).json({ error: "id_salon no encontrado" });
    }

    // Iniciar la transacción
    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });
    const query = `SELECT 
    review.*, 
    user.name
  FROM 
    review
  INNER JOIN 
    user 
  ON 
    review.id_user = user.id_user
  WHERE 
    review.id_salon = ?`;

    connection.query(query, [id_salon], (error, results) => {
      if (error) {
        console.error("Error al buscar el servicio:", error);
        return connection.rollback(() => {
          res.status(500).json({ error: "Error al buscar el servicio." });
        });
      }

      connection.commit((err) => {
        if (err) {
          console.error("Error al hacer commit:", err);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al buscar el servicio." });
          });
        }

        res.json(results);
      });
    });
  } catch (err) {
    console.error("Error al buscar el servicio:", err);
    res.status(500).json({ error: "Error al buscar el servicio." });
  }
});

router.put("/updateReview", async (req, res) => {
  try {
    const { id_review, respuesta, observacion, qualification } = req.body;
    //console.log('Respuesta recibida:', respuesta);

    if (!id_review || !observacion || !qualification) {
      return res
        .status(400)
        .json({ error: "Todos los campos son requeridos." });
    }
    // Agregar este log
    // Validar que `qualification` tenga las propiedades esperadas
    const { service, quality, cleanliness, speed } = qualification;
    if (
      typeof service !== "number" ||
      typeof quality !== "number" ||
      typeof cleanliness !== "number" ||
      typeof speed !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "Los valores de calificación son inválidos." });
    }

    // Función para redondear a medios
    const redondearAMedios = (numero: number) => {
      return Math.round(numero * 2) / 2;
    };

    // Calcular el promedio de la calificación y redondearlo a medios
    const averageQualification = redondearAMedios(
      (service + quality + cleanliness + speed) / 4
    );

    // Iniciar la transacción
    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });

    // Actualizar la reseña en la base de datos con el promedio redondeado
    const query = `
      UPDATE review
      SET observacion = ?, respuesta = ?, servicio = ?, calidad_precio = ?, limpieza = ?, puntualidad = ?, qualification = ? 
      WHERE id_review = ?
    `;

    // Ejecutar la consulta de actualización
    connection.query(
      query,
      [
        observacion,
        respuesta,
        service,
        quality,
        cleanliness,
        speed,
        averageQualification, // Guardar el promedio calculado y redondeado
        id_review,
      ],
      (error, results) => {
        if (error) {
          console.error("Error al actualizar la reseña:", error);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al actualizar la reseña." });
          });
        }

        // Confirmar la transacción
        connection.commit((err) => {
          if (err) {
            console.error("Error al hacer commit:", err);
            return connection.rollback(() => {
              res.status(500).json({ error: "Error al hacer commit." });
            });
          }

          res.json({ message: "Reseña actualizada exitosamente." });
        });
      }
    );
  } catch (err) {
    console.error("Error al actualizar la reseña:", err);
    res.status(500).json({ error: "Error al actualizar la reseña." });
  }
});

router.delete("/deleteReview", async (req, res) => {
  try {
    const { id_review } = req.query; // Cambiado para tomar de req.query

    //console.log("id_review recibida:", id_review);
    if (!id_review) {
      return res
        .status(400)
        .json({ error: "El parámetro 'id_review' es requerido." });
    }

    // Iniciar la transacción
    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });

    // Eliminar la reseña
    const query = `DELETE FROM review WHERE id_review = ?`;

    connection.query(query, [id_review], (error, results) => {
      if (error) {
        console.error("Error al eliminar la reseña:", error);
        return connection.rollback(() => {
          res.status(500).json({ error: "Error al eliminar la reseña." });
        });
      }

      connection.commit((err) => {
        if (err) {
          console.error("Error al hacer commit:", err);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al hacer commit." });
          });
        }

        res.json({ message: "Reseña eliminada exitosamente." });
      });
    });
  } catch (err) {
    console.error("Error al eliminar la reseña:", err);
    res.status(500).json({ error: "Error al eliminar la reseña." });
  }
});

router.get("/getAllCategoriesSalon", async (req: Request, res: Response) => {
  const query = `
      SELECT DISTINCT categories
      FROM categories
  `;

  // Iniciar la transacción
  connection.beginTransaction((err: Error | null) => {
    if (err) {
      console.error("Error iniciando la transacción:", err);
      return res.status(500).json({ error: "Error al iniciar la transacción" });
    }

    // Ejecutar la consulta SQL
    connection.query<RowDataPacket[]>(query, (error, results) => {
      if (error) {
        console.error("Error al obtener las categorías:", error);
        // Revertir la transacción en caso de error
        return connection.rollback(() => {
          res.status(500).json({ error: "Error al obtener las categorías" });
        });
      }

      // Procesar los resultados
      const processedResults = results.map((row) => ({
        category: row.categories,
      }));

      // Confirmar la transacción
      connection.commit((commitError: Error | null) => {
        if (commitError) {
          console.error("Error al confirmar la transacción:", commitError);
          // Revertir la transacción en caso de error al confirmar
          return connection.rollback(() => {
            res
              .status(500)
              .json({ error: "Error al confirmar la transacción" });
          });
        }

        // Enviar la respuesta exitosa
        res.json({ data: processedResults });
      });
    });
  });
});

router.post("/addCategorySalon", async (req, res) => {
  const { id_salon, category } = req.body;

  // Validar que los campos requeridos estén presentes
  if (!id_salon || !category) {
    return res
      .status(400)
      .json({ error: "id_salon y category son requeridos." });
  }

  // Consulta para insertar la nueva categoría
  const insertCategoryQuery = `
    INSERT INTO categories (id_salon, categories)
    VALUES (?, ?);
  `;

  try {
    // Iniciar transacción
    await new Promise((resolve, reject) => {
      connection.beginTransaction((transactionError) => {
        if (transactionError) {
          console.error("Error al iniciar la transacción:", transactionError);
          return reject(transactionError);
        }

        // Ejecutar la consulta para insertar la categoría
        connection.query(
          insertCategoryQuery,
          [id_salon, category],
          (queryError) => {
            if (queryError) {
              console.error("Error al insertar la categoría:", queryError);
              connection.rollback(() => reject(queryError));
              return;
            }

            // Commit de la transacción
            connection.commit((commitError) => {
              if (commitError) {
                console.error(
                  "Error al hacer commit de la transacción:",
                  commitError
                );
                connection.rollback(() => reject(commitError));
                return;
              }
              resolve(null);
            });
          }
        );
      });
    });

    // Respuesta de éxito
    res.json({ message: "Categoría añadida correctamente." });
  } catch (error) {
    console.error("Error en la transacción:", error);
    res.status(500).json({ error: "Ocurrió un error al añadir la categoría." });
  }
});

router.put("/updateCategorySalon", async (req, res) => {
  const { id_category, categories } = req.body;

  //console.log('id_category:', id_category);
  //console.log('categories:', categories);

  // Validar que los campos requeridos estén presentes
  if (!id_category || !categories) {
    return res
      .status(400)
      .json({ error: "id_category y categories son requeridos." });
  }

  // Consulta SQL para actualizar la categoría
  const updateCategoryQuery = `
    UPDATE categories
    SET categories = ?
    WHERE id_category = ?;
  `;

  // Forzar el tipo de resultado a ResultSetHeader
  connection.query<ResultSetHeader>(
    updateCategoryQuery,
    [categories, id_category],
    (error, results) => {
      if (error) {
        console.error("Error al actualizar la categoría:", error);
        return res
          .status(500)
          .json({ error: "Error al actualizar la categoría." });
      }

      //console.log('Resultados de la consulta:', results);

      // Acceder a affectedRows desde ResultSetHeader
      if (results.affectedRows === 0) {
        return res
          .status(404)
          .json({ error: "Categoría no encontrada o no se pudo actualizar." });
      }

      res.json({ message: "Categoría actualizada correctamente." });
    }
  );
});

router.delete("/deleteCategotySalon/:id_category", async (req, res) => {
  const { id_category } = req.params;

  // Verificar si id_category es válido
  if (!id_category) {
    return res
      .status(400)
      .json({ message: "ID de categoría no proporcionado" });
  }

  // Consulta SQL para eliminar la categoría
  const deleteQuery = "DELETE FROM categories WHERE id_category = ?";

  // Ejecutar la consulta
  connection.query(deleteQuery, [id_category], (err, result) => {
    if (err) {
      console.error("Error al eliminar la categoría:", err);
      return res
        .status(500)
        .json({ message: "Error al eliminar la categoría" });
    }

    // Convertir result a OkPacket para poder acceder a affectedRows
    const okResult = result as OkPacket;

    // Verificar si se eliminó alguna fila comprobando affectedRows
    if (okResult.affectedRows > 0) {
      return res
        .status(200)
        .json({ message: "Categoría eliminada exitosamente" });
    } else {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }
  });
});

router.post("/addBrandToSalon", (req, res) => {
  const { salonId, brandId } = req.body;

  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error starting transaction:", err);
      return res.status(500).json({
        success: false,
        message: "Error starting transaction",
        error: err,
      });
    }

    const insertServiceQuery =
      "INSERT INTO brands_salon (id_salon, id_brand) VALUES (?, ?)";

    connection.query(insertServiceQuery, [salonId, brandId], (err, result) => {
      if (err) {
        console.error("Error inserting service:", err);
        return connection.rollback(() => {
          res.status(500).json({
            success: false,
            message: "Error inserting service",
            error: err,
          });
        });
      }

      connection.commit((err) => {
        if (err) {
          console.error("Error committing transaction:", err);
          return connection.rollback(() => {
            res.status(500).json({
              success: false,
              message: "Error committing transaction",
              error: err,
            });
          });
        }
        res
          .status(200)
          .json({
            success: true,
            data: result,
            message: "Marca añadida al salón con éxito",
          });
      });
    });
  });
});


router.delete("/deleteBrandById", async (req, res) => {
  try {
    const { id_brand } = req.body;

    //console.log("id_brand recibido:", id_brand);

    if (!id_brand) {
      return res
        .status(400)
        .json({ error: "El parámetro 'id_brand' es requerido." });
    }

    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });

    const query = `DELETE FROM brands_salon WHERE id_brand = ?`;

    connection.query(query, [id_brand], (error, results) => {
      if (error) {
        console.error("Error al eliminar la marca:", error);
        return connection.rollback(() => {
          res.status(500).json({ error: "Error al eliminar la marca." });
        });
      }

      connection.commit((err) => {
        if (err) {
          console.error("Error al hacer commit:", err);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al hacer commit." });
          });
        }

        res.json({ message: "Marca eliminada exitosamente." });
      });
    });
  } catch (err) {
    console.error("Error al eliminar la marca:", err);
    res.status(500).json({ error: "Error al eliminar la marca." });
  }
});


export default router;
