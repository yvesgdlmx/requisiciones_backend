import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.mimetype === "application/pdf") {
      return {
        folder: "uploads",
        resource_type: "raw",
        format: "pdf",
        use_filename: true,
        unique_filename: true,
      };
    }

    return {
      folder: "uploads",
      resource_type: "image",
      format: file.mimetype.split("/")[1],
    };
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Tipo de archivo no permitido. Solo JPEG, JPG, PNG y PDF son aceptados.",
      ),
    );
  }
};

export const uploadConfig = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 5 },
});
