import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.mimetype === "application/pdf") {
      // Subir PDF como imagen (JPG, solo la primera página)
      return {
        folder: "uploads",
        resource_type: "image",
        format: "jpg", // convierte la primera página a jpg
        transformation: [{ page: 1 }], // solo la primera página
      };
    }
    // Para imágenes normales
    return {
      folder: "uploads",
      resource_type: "image",
      format: file.mimetype.split("/")[1], // jpg, png, etc.
    };
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf"
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tipo de archivo no permitido. Solo JPEG, JPG, PNG y PDF son aceptados."));
  }
};

export const uploadConfig = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 5 }
});