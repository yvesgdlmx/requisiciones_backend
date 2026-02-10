import Sequelize from 'sequelize'
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })

// Inicializamos Sequelize
const sequelize = new Sequelize(
  process.env.BD_NOMBRE,
  process.env.BD_USER,
  process.env.BD_PASS ?? '',
  {
    host: process.env.BD_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',

    // Mantener todo en UTC para evitar conversiones
    timezone: '+00:00',

    define: {
      timestamps: true
    },

    pool: {
      max: 10,
      min: 0,
      acquire: 60000,
      idle: 10000
    },

    operatorAliases: false,

    dialectOptions: {
      connectTimeout: 60000,
      // Desactivar conversión de timezone en MySQL
      timezone: '+00:00'
    },

    logging: false, // desactiva logs de SQL
    retry: {
      max: 3 // intenta reconectar hasta 3 veces antes de marcar error
    }
  }
)

// Función de conexión con reintento infinito
async function connectWithRetry() {
  let connected = false
  while (!connected) {
    try {
      await sequelize.authenticate()
      console.log('Conexión establecida con la base de datos.')
      connected = true
    } catch (error) {
      console.error('Error conectando a la DB:', error.message)
      console.log('Reintentando en 5 segundos...')
      await new Promise((res) => setTimeout(res, 5000))
    }
  }
}

connectWithRetry()

export default sequelize
