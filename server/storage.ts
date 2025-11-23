import { type User, type InsertUser, type PendingConversion, type InsertPendingConversion, pendingConversionsTable } from "@shared/schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  savePendingConversion(data: InsertPendingConversion): Promise<PendingConversion>;
  getPendingConversion(sessionId: string): Promise<PendingConversion | undefined>;
  deletePendingConversion(sessionId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private pendingConversions: Map<string, PendingConversion>;

  constructor() {
    this.users = new Map();
    this.pendingConversions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async savePendingConversion(data: InsertPendingConversion): Promise<PendingConversion> {
    const pending: PendingConversion = {
      ...data,
      createdAt: new Date(),
    };
    this.pendingConversions.set(data.sessionId, pending);
    return pending;
  }

  async getPendingConversion(sessionId: string): Promise<PendingConversion | undefined> {
    return this.pendingConversions.get(sessionId);
  }

  async deletePendingConversion(sessionId: string): Promise<void> {
    this.pendingConversions.delete(sessionId);
  }
}

// Check if we should use database or memory
let storageImpl: IStorage;
if (process.env.DATABASE_URL) {
  // TODO: Implement database storage when DB_URL is set
  // For now, use in-memory storage
  storageImpl = new MemStorage();
} else {
  storageImpl = new MemStorage();
}

export const storage = storageImpl;
