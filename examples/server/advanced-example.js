const { 
  PasskeyAuth, 
  MemoryChallengeStore, 
  MemoryUserStore 
} = require('../../dist/index.js');

/**
 * Ejemplo avanzado mostrando uso programático directo del plugin
 */
async function advancedExample() {
  console.log('🚀 Iniciando ejemplo avanzado de PasskeyAuth...');

  // 1. Configurar stores personalizados
  const challengeStore = new MemoryChallengeStore();
  const userStore = new MemoryUserStore();
  
  // 2. Configurar PasskeyAuth
  const passkeyAuth = new PasskeyAuth({
    rpName: 'Mi Aplicación',
    rpID: 'localhost',
    origin: 'http://localhost:3000',
    timeout: 60000,
    userVerification: 'preferred'
  }, userStore, challengeStore);

  try {
    // 3. Simular flujo de registro
    console.log('\\n📝 Simulando flujo de registro...');
    
    const userId = 'user123';
    const username = 'juan.perez';
    const displayName = 'Juan Pérez';
    
    // Generar opciones de registro
    const regOptions = await passkeyAuth.generateRegistrationOptions(
      userId, 
      username, 
      displayName
    );
    
    console.log('✅ Opciones de registro generadas:', {
      challenge: regOptions.challenge.substring(0, 20) + '...',
      user: regOptions.user,
      rp: regOptions.rp
    });

    // En una app real, aquí el cliente usaría estas opciones con navigator.credentials.create()
    // y enviaría la respuesta de vuelta al servidor
    
    // 4. Mostrar usuario creado
    const user = await passkeyAuth.getUser(userId);
    console.log('👤 Usuario creado:', {
      id: user?.id,
      username: user?.username,
      displayName: user?.displayName,
      credentialsCount: user?.credentials.length
    });

    // 5. Simular flujo de autenticación
    console.log('\\n🔐 Simulando flujo de autenticación...');
    
    const authOptions = await passkeyAuth.generateAuthenticationOptions(userId);
    console.log('✅ Opciones de autenticación generadas:', {
      challenge: authOptions.challenge.substring(0, 20) + '...',
      allowCredentials: authOptions.allowCredentials?.length || 0,
      userVerification: authOptions.userVerification
    });

    // 6. Ejemplo de búsqueda por username
    console.log('\\n🔍 Buscando usuario por username...');
    const foundUser = await passkeyAuth.getUserByUsername('juan.perez');
    console.log('✅ Usuario encontrado:', foundUser ? 'Sí' : 'No');

    // 7. Ejemplo de gestión de múltiples usuarios
    console.log('\\n👥 Creando múltiples usuarios...');
    
    const users = [
      { id: 'user456', username: 'maria.garcia', displayName: 'María García' },
      { id: 'user789', username: 'carlos.lopez', displayName: 'Carlos López' }
    ];

    for (const userData of users) {
      await passkeyAuth.generateRegistrationOptions(
        userData.id, 
        userData.username, 
        userData.displayName
      );
    }

    // Mostrar todos los usuarios
    const allUsers = await userStore.getAllUsers();
    console.log('📊 Total de usuarios:', allUsers.length);
    allUsers.forEach(user => {
      console.log(`   • ${user.username} (${user.displayName}) - ${user.credentials.length} passkeys`);
    });

    console.log('\\n✨ Ejemplo completado exitosamente!');

  } catch (error) {
    console.error('❌ Error en el ejemplo:', error.message);
  }
}

/**
 * Ejemplo de implementación de store personalizado con archivo JSON
 */
class FileUserStore {
  constructor(filename = './users.json') {
    this.filename = filename;
    this.users = new Map();
    this.usernameIndex = new Map();
    this.loadFromFile();
  }

  loadFromFile() {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.filename)) {
        const data = JSON.parse(fs.readFileSync(this.filename, 'utf8'));
        data.forEach(user => {
          // Convertir Uint8Arrays de vuelta desde arrays (solo publicKey)
          user.credentials = user.credentials.map(cred => ({
            ...cred,
            publicKey: new Uint8Array(cred.publicKey),
            createdAt: cred.createdAt ? new Date(cred.createdAt) : undefined,
            lastUsedAt: cred.lastUsedAt ? new Date(cred.lastUsedAt) : undefined
          }));
          this.users.set(user.id, user);
          this.usernameIndex.set(user.username, user.id);
        });
        console.log(`📁 Cargados ${data.length} usuarios desde ${this.filename}`);
      }
    } catch (error) {
      console.log(`⚠️  Error cargando ${this.filename}:`, error.message);
    }
  }

  saveToFile() {
    try {
      const fs = require('fs');
      const data = Array.from(this.users.values()).map(user => ({
        ...user,
        credentials: user.credentials.map(cred => ({
          ...cred,
          publicKey: Array.from(cred.publicKey)
          // id is already a string, no conversion needed
        }))
      }));
      fs.writeFileSync(this.filename, JSON.stringify(data, null, 2));
      console.log(`💾 Guardados ${data.length} usuarios en ${this.filename}`);
    } catch (error) {
      console.error(`❌ Error guardando ${this.filename}:`, error.message);
    }
  }

  async createUser(userData) {
    const user = { ...userData, credentials: [] };
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
    this.saveToFile();
    return user;
  }

  async getUserById(id) {
    return this.users.get(id) || null;
  }

  async getUserByUsername(username) {
    const userId = this.usernameIndex.get(username);
    return userId ? this.users.get(userId) || null : null;
  }

  async updateUser(user) {
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
    this.saveToFile();
    return user;
  }

  async addCredential(userId, credential) {
    const user = this.users.get(userId);
    if (!user) throw new Error(`Usuario ${userId} no encontrado`);

    const existingIndex = user.credentials.findIndex(cred =>
      cred.id === credential.id
    );

    if (existingIndex >= 0) {
      user.credentials[existingIndex] = credential;
    } else {
      user.credentials.push(credential);
    }

    this.users.set(userId, user);
    this.saveToFile();
  }

  async getUserByCredentialId(credentialId) {
    for (const user of this.users.values()) {
      const credential = user.credentials.find(cred => cred.id === credentialId);
      if (credential) {
        return { user, credential };
      }
    }
    return null;
  }

  async removeCredential(userId, credentialId) {
    const user = this.users.get(userId);
    if (!user) throw new Error(`Usuario ${userId} no encontrado`);

    user.credentials = user.credentials.filter(cred => cred.id !== credentialId);
    this.users.set(userId, user);
    this.saveToFile();
  }
}

// Ejemplo de store personalizado
async function customStoreExample() {
  console.log('\\n🗄️  Ejemplo con FileUserStore personalizado...');
  
  const challengeStore = new MemoryChallengeStore();
  const fileUserStore = new FileUserStore('./demo-users.json');
  
  const passkeyAuth = new PasskeyAuth({
    rpName: 'App con Persistencia',
    rpID: 'localhost',
    origin: 'http://localhost:3000'
  }, fileUserStore, challengeStore);
  
  // Crear usuario de prueba
  await passkeyAuth.generateRegistrationOptions(
    'persistent_user',
    'demo.user',
    'Usuario Demo'
  );
  
  console.log('✅ Usuario creado con store persistente');
}

// Ejecutar ejemplos si se llama directamente
if (require.main === module) {
  (async () => {
    await advancedExample();
    await customStoreExample();
  })();
}