"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        // Si no se usan, cambialos a _
        const uploadDir = path_1.default.join(__dirname, "uploadsExcel");
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    },
});
const upload = (0, multer_1.default)({ storage: storage });
exports.default = router;
