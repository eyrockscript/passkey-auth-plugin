import { Request, Response, NextFunction } from 'express';
import { PasskeyAuth } from '../PasskeyAuth';

export interface PasskeyRequest extends Request {
  passkeyAuth?: PasskeyAuth;
  user?: any;
}

/**
 * Crea un middleware de Express.js para integrar PasskeyAuth
 */
export function createExpressMiddleware(passkeyAuth: PasskeyAuth) {
  return (req: PasskeyRequest, res: Response, next: NextFunction) => {
    req.passkeyAuth = passkeyAuth;
    next();
  };
}

/**
 * Rutas predefinidas para Express.js
 */
export function createExpressRoutes(passkeyAuth: PasskeyAuth) {
  const router = require('express').Router();

  // Iniciar registro de passkey
  router.post('/passkey/register/begin', async (req: PasskeyRequest, res: Response) => {
    try {
      const { userId, username, displayName } = req.body;
      
      if (!userId || !username || !displayName) {
        return res.status(400).json({ 
          error: 'userId, username y displayName son requeridos' 
        });
      }

      const options = await passkeyAuth.generateRegistrationOptions(
        userId, 
        username, 
        displayName
      );
      
      res.json(options);
    } catch (error) {
      res.status(500).json({ 
        error: 'Error generando opciones de registro',
        details: (error as Error).message
      });
    }
  });

  // Completar registro de passkey
  router.post('/passkey/register/finish', async (req: PasskeyRequest, res: Response) => {
    try {
      const { userId, response } = req.body;
      
      if (!userId || !response) {
        return res.status(400).json({ 
          error: 'userId y response son requeridos' 
        });
      }

      const result = await passkeyAuth.verifyRegistration(userId, response);
      
      if (result.verified) {
        res.json({ 
          success: true, 
          message: 'Passkey registrado exitosamente',
          credential: result.credential
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        error: 'Error verificando registro',
        details: (error as Error).message
      });
    }
  });

  // Iniciar autenticación con passkey
  router.post('/passkey/authenticate/begin', async (req: PasskeyRequest, res: Response) => {
    try {
      const { userId } = req.body; // Opcional
      
      const options = await passkeyAuth.generateAuthenticationOptions(userId);
      
      res.json(options);
    } catch (error) {
      res.status(500).json({ 
        error: 'Error generando opciones de autenticación',
        details: (error as Error).message
      });
    }
  });

  // Completar autenticación con passkey
  router.post('/passkey/authenticate/finish', async (req: PasskeyRequest, res: Response) => {
    try {
      const { userId, response } = req.body;
      
      if (!response) {
        return res.status(400).json({ 
          error: 'response es requerido' 
        });
      }

      const result = await passkeyAuth.verifyAuthentication(response, userId);
      
      if (result.verified && result.user) {
        // Aquí podrías crear una sesión, JWT, etc.
        res.json({ 
          success: true, 
          message: 'Autenticación exitosa',
          user: {
            id: result.user.id,
            username: result.user.username,
            displayName: result.user.displayName
          }
        });
      } else {
        res.status(401).json({ 
          success: false, 
          error: result.error || 'Autenticación falló'
        });
      }
    } catch (error) {
      res.status(500).json({ 
        error: 'Error verificando autenticación',
        details: (error as Error).message
      });
    }
  });

  // Obtener información del usuario
  router.get('/passkey/user/:userId', async (req: PasskeyRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const user = await passkeyAuth.getUser(userId);
      
      if (user) {
        res.json({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          credentialCount: user.credentials.length
        });
      } else {
        res.status(404).json({ error: 'Usuario no encontrado' });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Error obteniendo usuario',
        details: (error as Error).message
      });
    }
  });

  // Listar todas las credenciales de un usuario
  router.get('/passkey/user/:userId/credentials', async (req: PasskeyRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const credentials = await passkeyAuth.listCredentials(userId);

      // Remover información sensible (publicKey)
      const safeCredentials = credentials.map(cred => ({
        id: cred.id,
        deviceType: cred.deviceType,
        backedUp: cred.backedUp,
        transports: cred.transports,
        name: cred.name,
        createdAt: cred.createdAt,
        lastUsedAt: cred.lastUsedAt,
      }));

      res.json({
        userId,
        credentials: safeCredentials,
        count: credentials.length,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Error listando credenciales',
        details: (error as Error).message
      });
    }
  });

  // Obtener información de una credencial específica
  router.get('/passkey/user/:userId/credentials/:credentialId', async (req: PasskeyRequest, res: Response) => {
    try {
      const { userId, credentialId } = req.params;
      const credential = await passkeyAuth.getCredential(userId, credentialId);

      if (!credential) {
        return res.status(404).json({ error: 'Credencial no encontrada' });
      }

      // Remover información sensible
      const safeCredential = {
        id: credential.id,
        deviceType: credential.deviceType,
        backedUp: credential.backedUp,
        transports: credential.transports,
        name: credential.name,
        createdAt: credential.createdAt,
        lastUsedAt: credential.lastUsedAt,
        counter: credential.counter,
      };

      res.json(safeCredential);
    } catch (error) {
      res.status(500).json({
        error: 'Error obteniendo credencial',
        details: (error as Error).message
      });
    }
  });

  // Eliminar una credencial
  router.delete('/passkey/user/:userId/credentials/:credentialId', async (req: PasskeyRequest, res: Response) => {
    try {
      const { userId, credentialId } = req.params;
      const success = await passkeyAuth.removeCredential(userId, credentialId);

      if (success) {
        res.json({
          success: true,
          message: 'Credencial eliminada exitosamente',
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'No se pudo eliminar la credencial',
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Error eliminando credencial',
        details: (error as Error).message
      });
    }
  });

  // Actualizar metadatos de una credencial
  router.patch('/passkey/user/:userId/credentials/:credentialId', async (req: PasskeyRequest, res: Response) => {
    try {
      const { userId, credentialId } = req.params;
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({
          error: 'Se requiere el campo "name"',
        });
      }

      const success = await passkeyAuth.updateCredentialMetadata(userId, credentialId, { name });

      if (success) {
        res.json({
          success: true,
          message: 'Credencial actualizada exitosamente',
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Usuario o credencial no encontrado',
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Error actualizando credencial',
        details: (error as Error).message
      });
    }
  });

  return router;
}