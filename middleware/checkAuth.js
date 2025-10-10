import jwt from "jsonwebtoken";
import Usuario from "../models/Usuario.js";

const checkAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "Token no proporcionado" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // token inválido / expirado
      return res.status(401).json({ msg: "Token no válido o expirado" });
    }

    const usuario = await Usuario.findByPk(decoded.id);

    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    console.error("Error en checkAuth:", error);
    return res.status(500).json({ msg: "Error en autenticación" });
  }
};

export default checkAuth;
