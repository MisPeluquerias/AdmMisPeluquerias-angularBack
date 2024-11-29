import express from "express";
import connection from "../../db/db";
import bodyParser from "body-parser";
import { ResultSetHeader } from "mysql2";
import decodeToken from "../../functions/decodeToken";

const router = express.Router();
router.use(bodyParser.json());

router.get("/getCategoriesJob", (req, res) => {
  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error iniciando la transacción:", err);
      return res.status(500).send("Error iniciando la transacción");
    }

    const query = "SELECT * FROM jobs_cat";

    connection.query(query, (error, results) => {
      if (error) {
        return connection.rollback(() => {
          console.error("Error ejecutando la consulta:", error);
          res.status(500).send("Error en la consulta");
        });
      }

      connection.commit((err) => {
        if (err) {
          return connection.rollback(() => {
            console.error("Error confirmando la transacción:", err);
            res.status(500).send("Error confirmando la transacción");
          });
        }
        res.json(results);
      });
    });
  });
});

// Endpoint para agregar una oferta de trabajo con transacción
router.post("/addJobOffer", (req, res) => {
  const {
    id_user,
    id_salon,
    category,
    subcategory,
    description,
    requirements,
    salary,
    img_job_path,
  } = req.body;

  // Valida que todos los campos necesarios estén presentes
  if (
    !category ||
    !subcategory ||
    !description ||
    !requirements ||
    !salary ||
    !img_job_path
  ) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  const id_user_decode = decodeToken(id_user);

  /*console.log(
    id_user_decode,
    id_salon,
    category,
    subcategory,
    description,
    requirements,
    salary,
    img_job_path
  );
  */

  // Inicia la transacción
  connection.beginTransaction((transactionError) => {
    if (transactionError) {
      console.error("Error al iniciar la transacción:", transactionError);
      return res.status(500).json({ error: "Error al iniciar la transacción" });
    }

    // Consulta para insertar la oferta de trabajo en la tabla
    const query = `
        INSERT INTO jobs_offers (id_user, id_salon, category, subcategory, description, requirements, salary, img_job_path, date_job_offer)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;

    // Ejecuta la consulta dentro de la transacción
    connection.query(
      query,
      [
        id_user_decode,
        id_salon,
        category,
        subcategory,
        description,
        requirements,
        salary,
        img_job_path,
      ],
      (error, results) => {
        if (error) {
          // Realiza un rollback si ocurre un error
          return connection.rollback(() => {
            console.error("Error al insertar la oferta de trabajo:", error);
            res
              .status(500)
              .json({ error: "Error al insertar la oferta de trabajo" });
          });
        }

        // Cast explícito para que TypeScript entienda que `results` tiene `insertId`
        const result = results as ResultSetHeader;

        // Realiza el commit si la inserción fue exitosa
        connection.commit((commitError) => {
          if (commitError) {
            // Realiza un rollback si ocurre un error durante el commit
            return connection.rollback(() => {
              console.error("Error al confirmar la transacción:", commitError);
              res
                .status(500)
                .json({ error: "Error al confirmar la transacción" });
            });
          }

          // Responde con éxito si todo se completó correctamente
          res.status(201).json({
            message: "Oferta de trabajo agregada con éxito",
            offerId: result.insertId,
          });
        });
      }
    );
  });
});

router.get("/getImgJob", (req, res) => {
  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error iniciando la transacción:", err);
      return res.status(500).send("Error iniciando la transacción");
    }

    const query = "SELECT * FROM jobs_img";

    connection.query(query, (error, results) => {
      if (error) {
        return connection.rollback(() => {
          console.error("Error ejecutando la consulta:", error);
          res.status(500).send("Error en la consulta");
        });
      }

      connection.commit((err) => {
        if (err) {
          return connection.rollback(() => {
            console.error("Error confirmando la transacción:", err);
            res.status(500).send("Error confirmando la transacción");
          });
        }
        res.json(results);
      });
    });
  });
});

router.get("/getSubCategoriesByCategory/:id_job_cat", (req, res) => {
  const { id_job_cat } = req.params;

  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error iniciando la transacción:", err);
      return res.status(500).send("Error iniciando la transacción");
    }

    const query = "SELECT * FROM jobs_subcat WHERE id_job_cat = ?";

    connection.query(query, [id_job_cat], (error, results) => {
      if (error) {
        return connection.rollback(() => {
          console.error("Error ejecutando la consulta:", error);
          res.status(500).send("Error en la consulta");
        });
      }

      connection.commit((err) => {
        if (err) {
          return connection.rollback(() => {
            console.error("Error confirmando la transacción:", err);
            res.status(500).send("Error confirmando la transacción");
          });
        }
        res.json(results);
      });
    });
  });
});

router.get("/getAlljobsOffers", (req, res) => {
  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error iniciando la transacción:", err);
      return res.status(500).send("Error iniciando la transacción");
    }

    // Parámetros de paginación
    const page = parseInt((req.query.page as string) || "1", 10);
    const pageSize = parseInt((req.query.pageSize as string) || "4", 10);
    const offset = (page - 1) * pageSize;

    // Consulta para obtener los registros con paginación
    const query = `
    SELECT 
      jobs_offers.*, 
      salon.name AS salon_name
    FROM 
      jobs_offers
    LEFT JOIN 
      salon 
    ON 
      jobs_offers.id_salon = salon.id_salon
    LIMIT ? OFFSET ?;
  `;

    // Consulta para contar el total de registros
    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM jobs_offers;
    `;

    // Ejecutar la consulta principal
    connection.query(query, [pageSize, offset], (error, results) => {
      if (error) {
        return connection.rollback(() => {
          console.error("Error ejecutando la consulta principal:", error);
          res.status(500).send("Error en la consulta principal");
        });
      }

      // Ejecutar la consulta de conteo
      connection.query(countQuery, (countError, countResults: any[]) => {
        if (countError) {
          return connection.rollback(() => {
            console.error(
              "Error ejecutando la consulta de conteo:",
              countError
            );
            res.status(500).send("Error en la consulta de conteo");
          });
        }

        connection.commit((commitErr) => {
          if (commitErr) {
            return connection.rollback(() => {
              console.error("Error confirmando la transacción:", commitErr);
              res.status(500).send("Error confirmando la transacción");
            });
          }

          // Respuesta al cliente
          const totalItems = countResults[0]?.total || 0;
          res.json({
            jobs: results,
            total: totalItems,
            currentPage: page,
            pageSize: pageSize,
          });
        });
      });
    });
  });
});

router.get("/getAlljobsOffersByUser/:id_user", (req, res) => {
  const { id_user } = req.params;

  // Decodificar el id_user
  const id_user_decode = decodeToken(id_user as string);

  if (!id_user_decode) {
    return res
      .status(400)
      .json({ message: "Token inválido o no se pudo decodificar" });
  }

  const page = parseInt((req.query.page as string) || "1", 10);
  const pageSize = parseInt((req.query.pageSize as string) || "4", 10);
  const offset = (page - 1) * pageSize;

  // Query para obtener los registros paginados
  const query = `
    SELECT 
      jobs_offers.*, 
      salon.name AS salon_name
    FROM 
      jobs_offers
    LEFT JOIN 
      salon 
    ON 
      jobs_offers.id_salon = salon.id_salon
    WHERE 
      jobs_offers.id_user = ?
    LIMIT ? OFFSET ?;
  `;

  // Query para obtener el total de registros
  const countQuery = `
    SELECT COUNT(*) AS total 
    FROM jobs_offers 
    WHERE id_user = ?;
  `;

  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error iniciando la transacción:", err);
      return res.status(500).json({ error: "Error iniciando la transacción" });
    }

    // Ejecutar la consulta principal
    connection.query(
      query,
      [id_user_decode, pageSize, offset],
      (error, results) => {
        if (error) {
          return connection.rollback(() => {
            console.error("Error ejecutando la consulta principal:", error);
            res
              .status(500)
              .json({ error: "Error ejecutando la consulta principal" });
          });
        }

        // Ejecutar la consulta de conteo
        connection.query(
          countQuery,
          [id_user_decode],
          (countError, countResults: any[]) => {
            if (countError) {
              return connection.rollback(() => {
                console.error(
                  "Error ejecutando la consulta de conteo:",
                  countError
                );
                res
                  .status(500)
                  .json({ error: "Error ejecutando la consulta de conteo" });
              });
            }

            // Confirmar la transacción
            connection.commit((commitErr) => {
              if (commitErr) {
                return connection.rollback(() => {
                  console.error("Error confirmando la transacción:", commitErr);
                  res
                    .status(500)
                    .json({ error: "Error confirmando la transacción" });
                });
              }

              // Respuesta al cliente
              const totalItems = countResults[0]?.total || 0; // Validar existencia del conteo
              res.json({
                jobs: results,
                total: totalItems,
                currentPage: page,
                pageSize: pageSize,
              });
            });
          }
        );
      }
    );
  });
});

router.get("/getSalonsByUser/:id_user", (req, res) => {
  const { id_user } = req.params;

  // Decodificar el id_user
  const id_user_decode = decodeToken(id_user as string);

  if (!id_user_decode) {
    return res
      .status(400)
      .json({ message: "Token inválido o no se pudo decodificar" });
  }

  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error iniciando la transacción:", err);
      return res
        .status(500)
        .json({ message: "Error iniciando la transacción" });
    }

    // Consulta con INNER JOIN para obtener los nombres de los salones
    const query = `
        SELECT s.id_salon, s.name AS salon_name
        FROM salon s
        INNER JOIN user_salon us ON s.id_salon = us.id_salon
        WHERE us.id_user = ?
      `;

    connection.query(query, [id_user_decode], (error, results) => {
      if (error) {
        console.error("Error ejecutando la consulta:", error);
        return connection.rollback(() => {
          res.status(500).json({ message: "Error ejecutando la consulta" });
        });
      }

      connection.commit((commitErr) => {
        if (commitErr) {
          console.error("Error confirmando la transacción:", commitErr);
          return connection.rollback(() => {
            res
              .status(500)
              .json({ message: "Error confirmando la transacción" });
          });
        }
        res.json(results);
        //console.log(results);
      });
    });
  });
});

router.delete("/deleteJobOffer/:id_job_offer", (req, res) => {
  const { id_job_offer } = req.params;

  // Validar el ID
  if (!id_job_offer || isNaN(Number(id_job_offer))) {
    return res.status(400).json({ message: "ID de la oferta no válido." });
  }

  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error al iniciar la transacción:", err);
      return res.status(500).json({ message: "Error interno del servidor." });
    }

    const deleteOfferQuery = "DELETE FROM jobs_offers WHERE id_job_offer = ?";

    // Cambiamos el tipo del resultado a ResultSetHeader
    connection.query<ResultSetHeader>(
      deleteOfferQuery,
      [id_job_offer],
      (queryErr, result) => {
        if (queryErr) {
          console.error("Error al eliminar la oferta de empleo:", queryErr);
          return connection.rollback(() => {
            res.status(500).json({ message: "Error interno del servidor." });
          });
        }

        // Verificar si se eliminó alguna fila
        if (result.affectedRows === 0) {
          return connection.rollback(() => {
            res
              .status(404)
              .json({ message: "Oferta de empleo no encontrada." });
          });
        }

        // Confirmar la transacción
        connection.commit((commitErr) => {
          if (commitErr) {
            console.error("Error al confirmar la transacción:", commitErr);
            return connection.rollback(() => {
              res.status(500).json({ message: "Error interno del servidor." });
            });
          }

          return res
            .status(200)
            .json({ message: "Oferta de empleo eliminada con éxito." });
        });
      }
    );
  });
});

router.get("/getJobInscriptions/:id_job_offer", async (req, res) => {
  const jobId = req.params.id_job_offer;
  //console.log('id_job_offer:', jobId);
  const query = `
      SELECT 
    u.name AS user_name,
    u.email AS user_email,
    js.date_subscriptions,
    js.path_curriculum
FROM user_job_subscriptions js
INNER JOIN user u ON js.id_user = u.id_user
WHERE js.id_job_offer = ?;
  `;

  connection.beginTransaction((err) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Error al iniciar la transacción", details: err });
    }

    connection.query(query, [jobId], (error, results) => {
      if (error) {
        return connection.rollback(() => {
          res
            .status(500)
            .json({ error: "Error al ejecutar la consulta", details: error });
        });
      }

      connection.commit((commitErr) => {
        if (commitErr) {
          return connection.rollback(() => {
            res
              .status(500)
              .json({
                error: "Error al confirmar la transacción",
                details: commitErr,
              });
          });
        }

        res.status(200).json({
          message: "Datos obtenidos con éxito",
          data: results,
        });
      });
    });
  });
});

export default router;
