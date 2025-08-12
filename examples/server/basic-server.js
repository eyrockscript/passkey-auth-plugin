const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar el plugin
const { 
  createPasskeyAuth, 
  createExpressRoutes,
  createExpressMiddleware 
} = require('../../dist/index.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(cors({
  origin: [`http://localhost:${PORT}`, 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../demo')));

// Configurar PasskeyAuth
const passkeyAuth = createPasskeyAuth({
  rpName: 'Demo Passkey App',
  rpID: 'localhost',
  origin: `http://localhost:${PORT}`,
  timeout: 60000,
  userVerification: 'preferred'
});

// Añadir middleware de passkey
app.use(createExpressMiddleware(passkeyAuth));

// Añadir rutas de passkey
app.use('/api', createExpressRoutes(passkeyAuth));

// Ruta de ejemplo para registro tradicional (simulado)
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  // Aquí normalmente verificarías el password, crearías el usuario en DB, etc.
  console.log('Registro tradicional:', { username, email });
  
  // Simular creación de usuario
  const userId = 'user_' + Date.now();
  
  res.json({
    success: true,
    message: 'Usuario registrado exitosamente',
    user: {
      id: userId,
      username,
      email,
      canSetupPasskey: true
    }
  });
});

// Ruta de ejemplo para login tradicional (simulado)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username y password requeridos' });
  }

  // Aquí normalmente verificarías las credenciales
  console.log('Login tradicional:', { username });
  
  if (password === 'demo123') {
    const userId = 'user_demo';
    res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        id: userId,
        username,
        hasPasskeys: false // Verificar si tiene passkeys registrados
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Credenciales inválidas'
    });
  }
});

// Servir la demo HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../demo/index.html'));
});

app.listen(PORT, () => {
  console.log(`\\n🔐 Servidor de demo corriendo en http://localhost:${PORT}`);
  console.log(`\\n📋 Endpoints disponibles:`);
  console.log(`   • GET  /                           - Demo visual`);
  console.log(`   • POST /api/register               - Registro tradicional`);
  console.log(`   • POST /api/login                  - Login tradicional`);
  console.log(`   • POST /api/passkey/register/begin - Iniciar registro passkey`);
  console.log(`   • POST /api/passkey/register/finish- Completar registro passkey`);
  console.log(`   • POST /api/passkey/authenticate/begin  - Iniciar auth passkey`);
  console.log(`   • POST /api/passkey/authenticate/finish - Completar auth passkey`);
  console.log(`   • GET  /api/passkey/user/:userId   - Info de usuario`);
  console.log(`\\n💡 Credenciales de prueba: usuario cualquiera, password: demo123`);
});