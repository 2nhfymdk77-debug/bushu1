import { eq, and, SQL, desc, gte, lte } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import {
  userConfigs,
  tradeTasks,
  signalExecutionRecords,
  backtestResults,
  manualInterventions,
  tradingLogs,
  systemStats,
  insertUserConfigSchema,
  insertTradeTaskSchema,
  insertSignalExecutionRecordSchema,
  insertBacktestResultSchema,
  insertManualInterventionSchema,
  insertTradingLogSchema,
  insertSystemStatSchema,
} from "./shared/schema";
import type {
  UserConfig,
  TradeTask,
  SignalExecutionRecord,
  BacktestResult,
  ManualIntervention,
  TradingLog,
  SystemStat,
  InsertUserConfig,
  InsertTradeTask,
  InsertSignalExecutionRecord,
  InsertBacktestResult,
  InsertManualIntervention,
  InsertTradingLog,
  InsertSystemStat,
} from "./shared/schema";

// 用户配置管理器
export class UserConfigManager {
  async createConfig(data: InsertUserConfig): Promise<UserConfig> {
    const db = await getDb();
    const validated = insertUserConfigSchema.parse(data);
    const [config] = await db.insert(userConfigs).values(validated).returning();
    return config;
  }

  async getConfigByUserId(userId: string): Promise<UserConfig | null> {
    const db = await getDb();
    const [config] = await db
      .select()
      .from(userConfigs)
      .where(eq(userConfigs.userId, userId));
    return config || null;
  }

  async updateConfig(userId: string, data: Partial<UserConfig>): Promise<UserConfig | null> {
    const db = await getDb();
    const [config] = await db
      .update(userConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userConfigs.userId, userId))
      .returning();
    return config || null;
  }

  async deleteConfig(userId: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(userConfigs).where(eq(userConfigs.userId, userId));
    return (result.rowCount ?? 0) > 0;
  }
}

// 交易任务管理器
export class TradeTaskManager {
  async createTask(data: InsertTradeTask): Promise<TradeTask> {
    const db = await getDb();
    const validated = insertTradeTaskSchema.parse(data);
    const [task] = await db.insert(tradeTasks).values(validated).returning();
    return task;
  }

  async getTaskById(id: string): Promise<TradeTask | null> {
    const db = await getDb();
    const [task] = await db.select().from(tradeTasks).where(eq(tradeTasks.id, id));
    return task || null;
  }

  async getTasksByUserId(userId: string): Promise<TradeTask[]> {
    const db = await getDb();
    return db
      .select()
      .from(tradeTasks)
      .where(eq(tradeTasks.userId, userId))
      .orderBy(desc(tradeTasks.createdAt));
  }

  async getTasksByStatus(status: string): Promise<TradeTask[]> {
    const db = await getDb();
    return db.select().from(tradeTasks).where(eq(tradeTasks.status, status));
  }

  async updateTask(id: string, data: Partial<TradeTask>): Promise<TradeTask | null> {
    const db = await getDb();
    const [task] = await db
      .update(tradeTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tradeTasks.id, id))
      .returning();
    return task || null;
  }

  async deleteTask(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(tradeTasks).where(eq(tradeTasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateTaskStats(
    id: string,
    stats: {
      totalSignals?: number;
      executedTrades?: number;
      totalProfit?: number;
      netProfit?: number;
      winRate?: number;
    }
  ): Promise<TradeTask | null> {
    const db = await getDb();
    const updateData: any = { ...stats, updatedAt: new Date() };

    // 将数值转换为字符串（因为数据库中是numeric类型）
    if (stats.totalProfit !== undefined) {
      updateData.totalProfit = stats.totalProfit.toString();
    }
    if (stats.netProfit !== undefined) {
      updateData.netProfit = stats.netProfit.toString();
    }
    if (stats.winRate !== undefined) {
      updateData.winRate = stats.winRate.toString();
    }

    const [task] = await db
      .update(tradeTasks)
      .set(updateData)
      .where(eq(tradeTasks.id, id))
      .returning();
    return task || null;
  }
}

// 信号执行记录管理器
export class SignalExecutionManager {
  async createRecord(data: InsertSignalExecutionRecord): Promise<SignalExecutionRecord> {
    const db = await getDb();
    const validated = insertSignalExecutionRecordSchema.parse(data);
    const [record] = await db.insert(signalExecutionRecords).values(validated).returning();
    return record;
  }

  async getRecordById(id: string): Promise<SignalExecutionRecord | null> {
    const db = await getDb();
    const [record] = await db.select().from(signalExecutionRecords).where(eq(signalExecutionRecords.id, id));
    return record || null;
  }

  async getRecordsByTaskId(taskId: string, limit?: number): Promise<SignalExecutionRecord[]> {
    const db = await getDb();
    const query = db
      .select()
      .from(signalExecutionRecords)
      .where(eq(signalExecutionRecords.taskId, taskId))
      .orderBy(desc(signalExecutionRecords.createdAt));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getRecordsByUserId(userId: string, limit?: number): Promise<SignalExecutionRecord[]> {
    const db = await getDb();
    const query = db
      .select()
      .from(signalExecutionRecords)
      .where(eq(signalExecutionRecords.userId, userId))
      .orderBy(desc(signalExecutionRecords.createdAt));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getRecordsBySymbol(symbol: string, limit?: number): Promise<SignalExecutionRecord[]> {
    const db = await getDb();
    const query = db
      .select()
      .from(signalExecutionRecords)
      .where(eq(signalExecutionRecords.symbol, symbol))
      .orderBy(desc(signalExecutionRecords.createdAt));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async updateRecord(id: string, data: Partial<SignalExecutionRecord>): Promise<SignalExecutionRecord | null> {
    const db = await getDb();
    const [record] = await db
      .update(signalExecutionRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(signalExecutionRecords.id, id))
      .returning();
    return record || null;
  }

  async getProfitStats(userId: string, startTime?: Date, endTime?: Date) {
    const db = await getDb();
    const conditions: SQL[] = [eq(signalExecutionRecords.userId, userId)];

    if (startTime) {
      conditions.push(gte(signalExecutionRecords.createdAt, startTime));
    }
    if (endTime) {
      conditions.push(lte(signalExecutionRecords.createdAt, endTime));
    }

    const records = await db
      .select()
      .from(signalExecutionRecords)
      .where(and(...conditions))
      .orderBy(desc(signalExecutionRecords.createdAt));

    const executedRecords = records.filter(r => r.executed && r.profit !== null);

    const totalProfit = executedRecords.reduce((sum, r) => sum + (parseFloat(r.profit?.toString() || "0")), 0);
    const winningTrades = executedRecords.filter(r => r.profit && parseFloat(r.profit.toString()) > 0).length;
    const losingTrades = executedRecords.filter(r => r.profit && parseFloat(r.profit.toString()) < 0).length;
    const winRate = executedRecords.length > 0 ? (winningTrades / executedRecords.length) * 100 : 0;

    return {
      totalTrades: executedRecords.length,
      winningTrades,
      losingTrades,
      totalProfit,
      winRate,
    };
  }
}

// 回测结果管理器
export class BacktestResultManager {
  async createResult(data: InsertBacktestResult): Promise<BacktestResult> {
    const db = await getDb();
    const validated = insertBacktestResultSchema.parse(data);
    const [result] = await db.insert(backtestResults).values(validated).returning();
    return result;
  }

  async getResultById(id: string): Promise<BacktestResult | null> {
    const db = await getDb();
    const [result] = await db.select().from(backtestResults).where(eq(backtestResults.id, id));
    return result || null;
  }

  async getResultsByUserId(userId: string, limit?: number): Promise<BacktestResult[]> {
    const db = await getDb();
    const query = db
      .select()
      .from(backtestResults)
      .where(eq(backtestResults.userId, userId))
      .orderBy(desc(backtestResults.createdAt));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getResultsByStrategy(strategyId: string, limit?: number): Promise<BacktestResult[]> {
    const db = await getDb();
    const query = db
      .select()
      .from(backtestResults)
      .where(eq(backtestResults.strategyId, strategyId))
      .orderBy(desc(backtestResults.createdAt));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async deleteResult(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(backtestResults).where(eq(backtestResults.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

// 手动干预记录管理器
export class ManualInterventionManager {
  async createRecord(data: InsertManualIntervention): Promise<ManualIntervention> {
    const db = await getDb();
    const validated = insertManualInterventionSchema.parse(data);
    const [record] = await db.insert(manualInterventions).values(validated).returning();
    return record;
  }

  async getRecordsByUserId(userId: string, limit?: number): Promise<ManualIntervention[]> {
    const db = await getDb();
    const query = db
      .select()
      .from(manualInterventions)
      .where(eq(manualInterventions.userId, userId))
      .orderBy(desc(manualInterventions.createdAt));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getRecordsByTaskId(taskId: string, limit?: number): Promise<ManualIntervention[]> {
    const db = await getDb();
    const query = db
      .select()
      .from(manualInterventions)
      .where(eq(manualInterventions.taskId, taskId))
      .orderBy(desc(manualInterventions.createdAt));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }
}

// 交易日志管理器
export class TradingLogManager {
  async createLog(data: InsertTradingLog): Promise<TradingLog> {
    const db = await getDb();
    const validated = insertTradingLogSchema.parse(data);
    const [log] = await db.insert(tradingLogs).values(validated).returning();
    return log;
  }

  async getLogsByUserId(userId: string, limit?: number, level?: string): Promise<TradingLog[]> {
    const db = await getDb();
    const conditions: SQL[] = [eq(tradingLogs.userId, userId)];

    if (level) {
      conditions.push(eq(tradingLogs.level, level));
    }

    const query = db
      .select()
      .from(tradingLogs)
      .where(and(...conditions))
      .orderBy(desc(tradingLogs.createdAt));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getLogsByTaskId(taskId: string, limit?: number): Promise<TradingLog[]> {
    const db = await getDb();
    const query = db
      .select()
      .from(tradingLogs)
      .where(eq(tradingLogs.taskId, taskId))
      .orderBy(desc(tradingLogs.createdAt));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async deleteOldLogs(userId: string, beforeDate: Date): Promise<number> {
    const db = await getDb();
    const result = await db
      .delete(tradingLogs)
      .where(and(eq(tradingLogs.userId, userId), lte(tradingLogs.createdAt, beforeDate)));
    return result.rowCount ?? 0;
  }
}

// 系统统计管理器
export class SystemStatsManager {
  async createStat(data: InsertSystemStat): Promise<SystemStat> {
    const db = await getDb();
    const validated = insertSystemStatSchema.parse(data);
    const [stat] = await db.insert(systemStats).values(validated).returning();
    return stat;
  }

  async getStatByDate(userId: string, date: string): Promise<SystemStat | null> {
    const db = await getDb();
    const [stat] = await db
      .select()
      .from(systemStats)
      .where(and(eq(systemStats.userId, userId), eq(systemStats.date, date)));
    return stat || null;
  }

  async getStatsByUserId(userId: string, limit?: number): Promise<SystemStat[]> {
    const db = await getDb();
    const query = db
      .select()
      .from(systemStats)
      .where(eq(systemStats.userId, userId))
      .orderBy(desc(systemStats.date));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async updateStat(userId: string, date: string, data: Partial<SystemStat>): Promise<SystemStat | null> {
    const db = await getDb();
    const [stat] = await db
      .update(systemStats)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(systemStats.userId, userId), eq(systemStats.date, date)))
      .returning();
    return stat || null;
  }

  async getTodayStats(userId: string): Promise<SystemStat | null> {
    const today = new Date().toISOString().split("T")[0];
    return await this.getStatByDate(userId, today);
  }

  async incrementTodayStats(userId: string, increments: {
    totalTasks?: number;
    activeTasks?: number;
    totalSignals?: number;
    totalTrades?: number;
  }): Promise<SystemStat | null> {
    const today = new Date().toISOString().split("T")[0];
    const existing = await this.getStatByDate(userId, today);

    if (!existing) {
      return await this.createStat({
        userId,
        date: today,
        totalTasks: increments.totalTasks || 0,
        activeTasks: increments.activeTasks || 0,
        totalSignals: increments.totalSignals || 0,
        totalTrades: increments.totalTrades || 0,
      });
    }

    return await this.updateStat(userId, today, {
      totalTasks: existing.totalTasks + (increments.totalTasks || 0),
      activeTasks: existing.activeTasks + (increments.activeTasks || 0),
      totalSignals: existing.totalSignals + (increments.totalSignals || 0),
      totalTrades: existing.totalTrades + (increments.totalTrades || 0),
    });
  }
}

// 导出单例实例
export const userConfigManager = new UserConfigManager();
export const tradeTaskManager = new TradeTaskManager();
export const signalExecutionManager = new SignalExecutionManager();
export const backtestResultManager = new BacktestResultManager();
export const manualInterventionManager = new ManualInterventionManager();
export const tradingLogManager = new TradingLogManager();
export const systemStatsManager = new SystemStatsManager();
