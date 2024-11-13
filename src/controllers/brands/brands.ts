import express from "express";
import connection from "../../db/db";
import bodyParser from "body-parser";
import { ResultSetHeader } from "mysql2";
import { RowDataPacket } from "mysql2";
import multer from "multer";
import path from "path";
import fs from "fs";
import { idText } from "typescript";




const router = express.Router();
router.use(bodyParser.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, "../../../dist/uploads/brands-pictures"));
  },
  filename: (req, file, cb) => {
    // Generar un nombre de archivo único con un prefijo y marca de tiempo
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, `brand-${uniqueSuffix}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/gif"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
    }
  },
});

router.get("/getAllBrands", async (req, res) => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const pageSize = parseInt((req.query.pageSize as string) || "10", 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : "%%";

    const query = `
    SELECT b.id_brand, b.name, b.imagePath, b.active, COUNT(sb.id_salon) AS totalSalones, 
           GROUP_CONCAT(bc.id_brand_category SEPARATOR ', ') AS category_ids,
           GROUP_CONCAT(bc.category SEPARATOR ', ') AS categories
    FROM brands b
    LEFT JOIN brands_salon sb ON b.id_brand = sb.id_brand
    LEFT JOIN brands_categories bc ON b.id_brand = bc.id_brand
    WHERE b.name LIKE ?
    GROUP BY b.id_brand
    ORDER BY b.name
    LIMIT ?, ?;
  `;

    const countQuery = `
      SELECT COUNT(*) AS totalItems 
      FROM brands 
      WHERE name LIKE ?;
    `;

    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error starting transaction:", err);
        return res
          .status(500)
          .json({ error: "An error occurred while starting transaction" });
      }

      connection.query(
        query,
        [search, offset, pageSize],
        (error, results: RowDataPacket[]) => {
          if (error) {
            console.error("Error fetching data:", error);
            return connection.rollback(() => {
              res
                .status(500)
                .json({ error: "An error occurred while fetching data" });
            });
          }

          connection.query(
            countQuery,
            [search],
            (countError, countResults: RowDataPacket[]) => {
              if (countError) {
                console.error("Error fetching count:", countError);
                return connection.rollback(() => {
                  res
                    .status(500)
                    .json({
                      error: "An error occurred while fetching data count",
                    });
                });
              }

              const totalItems = countResults[0].totalItems;

              // Procesar resultados y añadir las categorías
              const processedResults = results.map((row: any) => ({
                id_brand: row.id_brand,
                name: row.name,
                imagePath: row.imagePath,
                active: row.active,
                totalSalones: row.totalSalones,
                categories: row.categories || '',
                id_brand_category: row.category_ids  // Devolver las categorías separadas por comas
              }));

              connection.commit((commitError) => {
                if (commitError) {
                  console.error("Error committing transaction:", commitError);
                  return connection.rollback(() => {
                    res
                      .status(500)
                      .json({
                        error: "An error occurred while committing transaction",
                      });
                  });
                }

                res.json({ data: processedResults, totalItems });
              });
            }
          );
        }
      );
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});





router.get("/searchCategoryInLive", async (req, res) => {
  try {
    const { category } = req.query;
    if (!category) {
      return res
        .status(400)
        .json({ error: "El parámetro 'category' es requerido." });
    }

    // Iniciar la transacción
    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });

    const query =
      "SELECT DISTINCT categories FROM categories WHERE categories LIKE ?";

    connection.query(query, [`%${category}%`], (error, results) => {
      if (error) {
        console.error("Error al buscar la categoria:", error);
        return connection.rollback(() => {
          res.status(500).json({ error: "Error al buscar categoria." });
        });
      }

      connection.commit((err) => {
        if (err) {
          console.error("Error al hacer commit:", err);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al buscar categoria." });
          });
        }

        res.json(results);
      });
    });
  } catch (err) {
    console.error("Error al buscar categoria:", err);
    res.status(500).json({ error: "Error al buscar la categoria." });
  }
});



router.post("/addBrand", upload.single("brandImage"), async (req, res) => {
  try {
    const { name, categories } = req.body; // Recibir las categorías desde el cliente
    const brandImage = req.file;

    if (!name) {
      return res.status(400).json({ error: "El nombre de la marca es requerido" });
    }

    if (!brandImage) {
      return res.status(400).json({ error: "La imagen es requerida" });
    }

    // Asegurarse de que las categorías están parseadas correctamente si vienen como JSON string
    let parsedCategories;
    if (typeof categories === "string") {
      try {
        parsedCategories = JSON.parse(categories);
      } catch (err) {
        return res.status(400).json({ error: "El formato de las categorías es incorrecto" });
      }
    } else {
      parsedCategories = categories;
    }

    // Consulta para verificar si la marca ya existe
    const checkBrandQuery = "SELECT COUNT(*) AS count FROM brands WHERE name = ?";
    connection.query(checkBrandQuery, [name], (err, result:any) => {
      if (err) {
        console.error("Error al verificar si la marca existe:", err);
        return res.status(500).json({ error: "Ocurrió un error al verificar el nombre de la marca" });
      }
      if (result[0].count > 0) {
        return res.status(400).json({ error: "El nombre de la marca ya existe" });
      }

      // Construir la URL completa basada en el servidor
      const serverUrl = `${req.protocol}://${req.get("host")}`;
      const imageUrl = `${serverUrl}/uploads/brands-pictures/${brandImage.filename}`;

      const insertBrandQuery = `
        INSERT INTO brands (name, imagePath, active)
        VALUES (?, ?, ?);
      `;

      connection.beginTransaction((err) => {
        if (err) {
          console.error("Error al iniciar la transacción:", err);
          return res.status(500).json({ error: "Ocurrió un error al iniciar la transacción" });
        }

        // Insertar la marca
        connection.query<ResultSetHeader>(
          insertBrandQuery,
          [name, imageUrl, 1], // El valor de "active" es 1 por defecto
          (error, results) => {
            if (error) {
              console.error("Error al insertar los datos:", error);
              return connection.rollback(() => {
                res.status(500).json({ error: "Ocurrió un error al insertar los datos" });
              });
            }

            const brandId = results.insertId; // Obtener el ID de la marca insertada

            // Si no hay categorías, continuar con el commit
            if (!parsedCategories || parsedCategories.length === 0) {
              return connection.commit((commitError) => {
                if (commitError) {
                  console.error("Error al confirmar la transacción:", commitError);
                  return connection.rollback(() => {
                    res.status(500).json({ error: "Ocurrió un error al confirmar la transacción" });
                  });
                }
                res.status(201).json({ message: "Marca añadida exitosamente" });
              });
            }

            // Insertar las categorías asociadas
            const insertCategoriesQuery = `
              INSERT INTO brands_categories (id_brand, category)
              VALUES ?
            `;

            // Preparar los valores a insertar
            const categoryValues = parsedCategories.map((category:any) => [brandId, category]);

            connection.query(
              insertCategoriesQuery,
              [categoryValues],
              (catError) => {
                if (catError) {
                  console.error("Error al insertar las categorías:", catError);
                  return connection.rollback(() => {
                    res.status(500).json({ error: "Ocurrió un error al insertar las categorías" });
                  });
                }

                // Confirmar la transacción si todo fue exitoso
                connection.commit((commitError) => {
                  if (commitError) {
                    console.error("Error al confirmar la transacción:", commitError);
                    return connection.rollback(() => {
                      res.status(500).json({ error: "Ocurrió un error al confirmar la transacción" });
                    });
                  }

                  res.status(201).json({ message: "Marca y categorías añadidas exitosamente" });
                });
              }
            );
          }
        );
      });
    });
  } catch (err) {
    console.error("Error inesperado:", err);
    res.status(500).json({ error: "Ocurrió un error inesperado" });
  }
});





router.post("/deleteBrand", (req, res) => {
  const { id_brand } = req.body;

  // Validar que se proporcionen los IDs y que sea un array válido
  if (!id_brand || !Array.isArray(id_brand) || id_brand.length === 0) {
    return res.status(400).json({ message: "No hay marcas para eliminar" });
  }

  // Iniciar la transacción
  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error iniciando la transacción:", err);
      return res
        .status(500)
        .json({ message: "Error al iniciar la transacción" });
    }

    // Consulta para obtener las rutas de las imágenes de las marcas que se van a eliminar
    const selectQuery = `SELECT imagePath FROM brands WHERE id_brand IN (?)`;
    connection.query<RowDataPacket[]>(
      selectQuery,
      [id_brand],
      (selectError, selectResults) => {
        if (selectError) {
          console.error(
            "Error al obtener las rutas de las imágenes:",
            selectError
          );
          return connection.rollback(() => {
            res
              .status(500)
              .json({ message: "Error al obtener las rutas de las imágenes" });
          });
        }

        if (selectResults.length === 0) {
          console.error("No se encontraron marcas con los IDs proporcionados.");
          return connection.rollback(() => {
            res
              .status(404)
              .json({ message: "No se encontraron marcas para eliminar" });
          });
        }

        // Procesar cada marca encontrada
        selectResults.forEach((row) => {
          const fileUrl = row.imagePath;
          const fileName = path.basename(fileUrl);

          // Construir la ruta del archivo en el sistema de archivos
          const filePath = path.join(
            __dirname,
            "../../uploads/brands-pictures",
            fileName
          );

          // Verificar si el archivo existe
          fs.access(filePath, fs.constants.F_OK, (accessErr) => {
            if (accessErr) {
              console.error(
                `Archivo no encontrado en el servidor: ${filePath}`
              );
              // No detenemos el proceso si el archivo no existe
              return;
            }

            // Eliminar el archivo del sistema de archivos
            fs.unlink(filePath, (unlinkErr) => {
              if (unlinkErr) {
                console.error(
                  `Error al eliminar el archivo: ${filePath}`,
                  unlinkErr
                );
                // No hacemos rollback ya que la eliminación del archivo no afecta la integridad de la base de datos
              } else {
                //console.log(`Archivo eliminado exitosamente: ${filePath}`);
              }
            });
          });
        });

        // Primero, eliminar las categorías asociadas en `brands_categories`
        const deleteCategoriesQuery = `DELETE FROM brands_categories WHERE id_brand IN (?)`;
        connection.query<ResultSetHeader>(
          deleteCategoriesQuery,
          [id_brand],
          (deleteCatError) => {
            if (deleteCatError) {
              console.error(
                "Error al eliminar las categorías asociadas:",
                deleteCatError
              );
              return connection.rollback(() => {
                res
                  .status(500)
                  .json({
                    message: "Error al eliminar las categorías asociadas",
                  });
              });
            }

            // Eliminar las marcas de la base de datos
            const deleteQuery = `DELETE FROM brands WHERE id_brand IN (?)`;
            connection.query<ResultSetHeader>(
              deleteQuery,
              [id_brand],
              (deleteError, deleteResults) => {
                if (deleteError) {
                  console.error("Error al eliminar las marcas:", deleteError);
                  return connection.rollback(() => {
                    res
                      .status(500)
                      .json({ message: "Error al eliminar las marcas" });
                  });
                }

                if (deleteResults.affectedRows === 0) {
                  console.error("No se encontraron marcas para eliminar.");
                  return connection.rollback(() => {
                    res
                      .status(404)
                      .json({
                        message: "No se encontraron marcas para eliminar",
                      });
                  });
                }

                // Confirmar la transacción
                connection.commit((commitErr) => {
                  if (commitErr) {
                    console.error(
                      "Error al confirmar la transacción:",
                      commitErr
                    );
                    return connection.rollback(() => {
                      res
                        .status(500)
                        .json({ message: "Error al confirmar la transacción" });
                    });
                  }

                  //console.log('Marcas e imágenes eliminadas con éxito');
                  res
                    .status(200)
                    .json({
                      message: "Marcas e imágenes eliminadas con éxito",
                    });
                });
              }
            );
          }
        );
      }
    );
  });
}); 



// Endpoint para actualizar una marca
router.put("/updateBrand/:id_brand", upload.single("brandImage"), async (req, res) => {
  const { id_brand } = req.params;
  const { name, categories } = req.body; // Recibir las categorías como JSON string
  const brandImage = req.file;

  //console.log("Categorias recibidas:", categories);

  if (!name) {
    return res.status(400).json({ error: "El nombre de la marca es requerido" });
  }

  try {
    // Iniciar la transacción
    connection.beginTransaction(async (err) => {
      if (err) {
        console.error("Error iniciando la transacción:", err);
        return res.status(500).json({ error: "Error al iniciar la transacción" });
      }

      // Obtener la imagen actual antes de actualizar
      const getBrandQuery = `SELECT imagePath FROM brands WHERE id_brand = ?`;
      connection.query(getBrandQuery, [id_brand], (getError, results:any) => {
        if (getError) {
          console.error("Error obteniendo la imagen actual:", getError);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al obtener la imagen actual" });
          });
        }

        const currentImagePath = results[0]?.imagePath;

        // Si hay una nueva imagen, eliminar la anterior del servidor
        if (brandImage && currentImagePath) {
          const projectRoot = path.resolve(__dirname, "../../"); // Subimos dos niveles desde 'dist/controllers'
          const imagePathToDelete = path.join(projectRoot, "uploads/brands-pictures", path.basename(currentImagePath));

          // Verificar si el archivo existe antes de eliminarlo
          if (fs.existsSync(imagePathToDelete)) {
            fs.unlink(imagePathToDelete, (unlinkError) => {
              if (unlinkError) {
                console.warn("Advertencia: Error eliminando la imagen anterior:", unlinkError);
              }
            });
          } else {
            console.warn(`Advertencia: La imagen no existe en la ruta: ${imagePathToDelete}`);
          }
        }

        // Actualizar nombre y ruta de imagen
        let updateBrandQuery = `
          UPDATE brands 
          SET name = ?, active = 1
        `;
        const params = [name];

        if (brandImage) {
          const serverUrl = `${req.protocol}://${req.get("host")}`;
          const imageUrl = `${serverUrl}/uploads/brands-pictures/${brandImage.filename}`;
          updateBrandQuery += `, imagePath = ? `;
          params.push(imageUrl);
        }

        updateBrandQuery += `WHERE id_brand = ?`;
        params.push(id_brand);

        connection.query(updateBrandQuery, params, (updateError) => {
          if (updateError) {
            console.error("Error actualizando la marca:", updateError);
            return connection.rollback(() => {
              res.status(500).json({ error: "Error al actualizar la marca" });
            });
          }

          // Eliminar categorías existentes
          const deleteCategoriesQuery = `DELETE FROM brands_categories WHERE id_brand = ?`;
          connection.query(deleteCategoriesQuery, [id_brand], (deleteError) => {
            if (deleteError) {
              console.error("Error eliminando las categorías:", deleteError);
              return connection.rollback(() => {
                res.status(500).json({ error: "Error al eliminar las categorías" });
              });
            }

            // Insertar nuevas categorías si existen
            if (categories) {
              let parsedCategories;
              try {
                parsedCategories = JSON.parse(categories); // Asegurarse de que es un array
                if (!Array.isArray(parsedCategories)) {
                  throw new Error("Categories should be an array");
                }
              } catch (e) {
                return res.status(400).json({ error: "Formato de categorías incorrecto" });
              }

              if (parsedCategories.length > 0) {
                const insertCategoriesQuery = `INSERT INTO brands_categories (id_brand, category) VALUES ?`;

                // Extraer el nombre de cada categoría del objeto y construir los valores para la consulta
                const categoryValues = parsedCategories.map((category) => [id_brand, category.name]);

                connection.query(insertCategoriesQuery, [categoryValues], (insertError) => {
                  if (insertError) {
                    console.error("Error insertando categorías:", insertError);
                    return connection.rollback(() => {
                      res.status(500).json({ error: "Error al insertar categorías" });
                    });
                  }

                  // Si todo fue exitoso, hacer commit de la transacción
                  connection.commit((commitError) => {
                    if (commitError) {
                      console.error("Error al confirmar la transacción:", commitError);
                      return connection.rollback(() => {
                        res.status(500).json({ error: "Error al confirmar la transacción" });
                      });
                    }

                    res.status(200).json({ message: "Marca actualizada con éxito" });
                  });
                });
              } else {
                // Si no hay categorías, hacer commit directamente
                connection.commit((commitError) => {
                  if (commitError) {
                    console.error("Error al confirmar la transacción:", commitError);
                    return connection.rollback(() => {
                      res.status(500).json({ error: "Error al confirmar la transacción" });
                    });
                  }

                  res.status(200).json({ message: "Marca actualizada con éxito" });
                });
              }
            } else {
              // Si no hay categorías, hacer commit directamente
              connection.commit((commitError) => {
                if (commitError) {
                  console.error("Error al confirmar la transacción:", commitError);
                  return connection.rollback(() => {
                    res.status(500).json({ error: "Error al confirmar la transacción" });
                  });
                }

                res.status(200).json({ message: "Marca actualizada con éxito" });
              });
            }
          });
        });
      });
    });
  } catch (err) {
    console.error("Error inesperado:", err);
    res.status(500).json({ error: "Ocurrió un error inesperado" });
  }
});



export default router;
