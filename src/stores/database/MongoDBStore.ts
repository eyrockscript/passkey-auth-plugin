import { PasskeyUser, PasskeyCredential, UserStore } from '../../types';

/**
 * MongoDB UserStore implementation using Mongoose
 *
 * @example
 * ```typescript
 * import mongoose from 'mongoose';
 * import { MongoDBUserStore } from 'passkey-auth-plugin/stores/database/MongoDBStore';
 *
 * await mongoose.connect('mongodb://localhost:27017/myapp');
 * const userStore = new MongoDBUserStore();
 * ```
 */
export class MongoDBUserStore implements UserStore {
  private mongoose: any;
  private UserModel: any;

  constructor(mongooseInstance?: any) {
    if (mongooseInstance) {
      this.mongoose = mongooseInstance;
    } else {
      try {
        this.mongoose = require('mongoose');
      } catch (error) {
        throw new Error('Mongoose is required for MongoDBUserStore. Install it with: npm install mongoose');
      }
    }

    this.initializeModel();
  }

  private initializeModel() {
    const { Schema } = this.mongoose;

    // Verificar si el modelo ya existe
    if (this.mongoose.models.PasskeyUser) {
      this.UserModel = this.mongoose.models.PasskeyUser;
      return;
    }

    const CredentialSchema = new Schema({
      id: { type: String, required: true },
      publicKey: { type: Buffer, required: true },
      counter: { type: Number, required: true },
      deviceType: { type: String, enum: ['singleDevice', 'multiDevice'], required: true },
      backedUp: { type: Boolean, required: true },
      transports: [{ type: String }],
      name: { type: String },
      createdAt: { type: Date, default: Date.now },
      lastUsedAt: { type: Date, default: Date.now },
    });

    const UserSchema = new Schema({
      id: { type: String, required: true, unique: true, index: true },
      username: { type: String, required: true, unique: true, index: true },
      displayName: { type: String, required: true },
      credentials: [CredentialSchema],
    }, {
      timestamps: true,
    });

    this.UserModel = this.mongoose.model('PasskeyUser', UserSchema);
  }

  async createUser(userData: Omit<PasskeyUser, 'credentials'>): Promise<PasskeyUser> {
    const user = new this.UserModel({
      ...userData,
      credentials: [],
    });

    await user.save();

    return this.mongoDocToUser(user);
  }

  async getUserById(id: string): Promise<PasskeyUser | null> {
    const user = await this.UserModel.findOne({ id }).exec();
    return user ? this.mongoDocToUser(user) : null;
  }

  async getUserByUsername(username: string): Promise<PasskeyUser | null> {
    const user = await this.UserModel.findOne({ username }).exec();
    return user ? this.mongoDocToUser(user) : null;
  }

  async getUserByCredentialId(credentialId: string): Promise<{ user: PasskeyUser; credential: PasskeyCredential } | null> {
    const user = await this.UserModel.findOne({
      'credentials.id': credentialId
    }).exec();

    if (!user) return null;

    const passkeyUser = this.mongoDocToUser(user);
    const credential = passkeyUser.credentials.find(cred => cred.id === credentialId);

    if (!credential) return null;

    return { user: passkeyUser, credential };
  }

  async updateUser(user: PasskeyUser): Promise<PasskeyUser> {
    const updateData = {
      username: user.username,
      displayName: user.displayName,
      credentials: user.credentials.map(cred => ({
        id: cred.id,
        publicKey: Buffer.from(cred.publicKey),
        counter: cred.counter,
        deviceType: cred.deviceType,
        backedUp: cred.backedUp,
        transports: cred.transports,
        name: cred.name,
        createdAt: cred.createdAt,
        lastUsedAt: cred.lastUsedAt,
      })),
    };

    const updated = await this.UserModel.findOneAndUpdate(
      { id: user.id },
      updateData,
      { new: true }
    ).exec();

    return this.mongoDocToUser(updated);
  }

  async addCredential(userId: string, credential: PasskeyCredential): Promise<void> {
    const user = await this.UserModel.findOne({ id: userId }).exec();

    if (!user) {
      throw new Error(`Usuario con ID ${userId} no encontrado`);
    }

    // Verificar si ya existe
    const existingIndex = user.credentials.findIndex((cred: any) => cred.id === credential.id);

    if (existingIndex >= 0) {
      user.credentials[existingIndex] = {
        ...credential,
        publicKey: Buffer.from(credential.publicKey),
      };
    } else {
      user.credentials.push({
        ...credential,
        publicKey: Buffer.from(credential.publicKey),
      });
    }

    await user.save();
  }

  async removeCredential(userId: string, credentialId: string): Promise<void> {
    const user = await this.UserModel.findOne({ id: userId }).exec();

    if (!user) {
      throw new Error(`Usuario con ID ${userId} no encontrado`);
    }

    user.credentials = user.credentials.filter((cred: any) => cred.id !== credentialId);
    await user.save();
  }

  private mongoDocToUser(doc: any): PasskeyUser {
    return {
      id: doc.id,
      username: doc.username,
      displayName: doc.displayName,
      credentials: doc.credentials.map((cred: any) => ({
        id: cred.id,
        publicKey: new Uint8Array(cred.publicKey.buffer),
        counter: cred.counter,
        deviceType: cred.deviceType,
        backedUp: cred.backedUp,
        transports: cred.transports,
        name: cred.name,
        createdAt: cred.createdAt,
        lastUsedAt: cred.lastUsedAt,
      })),
    };
  }
}
