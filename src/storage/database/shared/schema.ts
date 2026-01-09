import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

// 使用 createSchemaFactory 配置 date coercion
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// 用户配置表
export const userConfigs = pgTable(
  "user_configs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 }).notNull(),
    exchangeType: varchar("exchange_type", { length: 50 }).notNull().default("binance"),
    apiKey: text("api_key").notNull(),
    apiSecret: text("api_secret").notNull(),
    testnet: boolean("testnet").default(false).notNull(),
    enableTrading: boolean("enable_trading").default(false).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index("user_configs_user_id_idx").on(table.userId),
  })
);

// 交易任务表
export const tradeTasks = pgTable(
  "trade_tasks",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    strategyId: varchar("strategy_id", { length: 255 }).notNull(),
    strategyName: varchar("strategy_name", { length: 255 }).notNull(),
    strategyParams: jsonb("strategy_params").notNull().default(sql`'{}'::jsonb`),
    symbols: jsonb("symbols").notNull().default(sql`'[]'::jsonb`),
    timeframes: jsonb("timeframes").notNull().default(sql`'[]'::jsonb`),
    riskControl: jsonb("risk_control").notNull().default(sql`'{}'::jsonb`),
    status: varchar("status", { length: 20 }).notNull().default("idle"),
    startTime: timestamp("start_time", { withTimezone: true }),
    stopTime: timestamp("stop_time", { withTimezone: true }),
    totalSignals: integer("total_signals").default(0).notNull(),
    executedTrades: integer("executed_trades").default(0).notNull(),
    totalProfit: numeric("total_profit", { precision: 20, scale: 8 }).default("0").notNull(),
    netProfit: numeric("net_profit", { precision: 20, scale: 8 }).default("0").notNull(),
    winRate: numeric("win_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index("trade_tasks_user_id_idx").on(table.userId),
    statusIdx: index("trade_tasks_status_idx").on(table.status),
  })
);

// 信号执行记录表
export const signalExecutionRecords = pgTable(
  "signal_execution_records",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    taskId: varchar("task_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    direction: varchar("direction", { length: 10 }).notNull(),
    signalTime: timestamp("signal_time", { withTimezone: true }).notNull(),
    signalPrice: numeric("signal_price", { precision: 20, scale: 8 }).notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 2 }).default("0").notNull(),
    reason: text("reason").notNull(),
    executed: boolean("executed").default(false).notNull(),
    executionTime: timestamp("execution_time", { withTimezone: true }),
    orderId: integer("order_id"),
    executionPrice: numeric("execution_price", { precision: 20, scale: 8 }),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    positionValue: numeric("position_value", { precision: 20, scale: 8 }).notNull(),
    exitTime: timestamp("exit_time", { withTimezone: true }),
    exitPrice: numeric("exit_price", { precision: 20, scale: 8 }),
    exitReason: text("exit_reason"),
    profit: numeric("profit", { precision: 20, scale: 8 }),
    profitPercent: numeric("profit_percent", { precision: 10, scale: 2 }),
    error: text("error"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    taskIdIdx: index("signal_execution_records_task_id_idx").on(table.taskId),
    userIdIdx: index("signal_execution_records_user_id_idx").on(table.userId),
    executedIdx: index("signal_execution_records_executed_idx").on(table.executed),
    symbolIdx: index("signal_execution_records_symbol_idx").on(table.symbol),
  })
);

// 回测结果表
export const backtestResults = pgTable(
  "backtest_results",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 }).notNull(),
    strategyId: varchar("strategy_id", { length: 255 }).notNull(),
    strategyName: varchar("strategy_name", { length: 255 }).notNull(),
    strategyParams: jsonb("strategy_params").notNull().default(sql`'{}'::jsonb`),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    timeframe: varchar("timeframe", { length: 20 }).notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    initialBalance: numeric("initial_balance", { precision: 20, scale: 8 }).notNull(),
    commissionRate: numeric("commission_rate", { precision: 10, scale: 6 }).notNull(),
    slippage: numeric("slippage", { precision: 10, scale: 6 }).notNull(),
    totalTrades: integer("total_trades").notNull(),
    winningTrades: integer("winning_trades").notNull(),
    losingTrades: integer("losing_trades").notNull(),
    winRate: numeric("win_rate", { precision: 5, scale: 2 }).notNull(),
    totalProfit: numeric("total_profit", { precision: 20, scale: 8 }).notNull(),
    totalLoss: numeric("total_loss", { precision: 20, scale: 8 }).notNull(),
    netProfit: numeric("net_profit", { precision: 20, scale: 8 }).notNull(),
    profitFactor: numeric("profit_factor", { precision: 20, scale: 8 }).notNull(),
    maxDrawdown: numeric("max_drawdown", { precision: 20, scale: 8 }).notNull(),
    maxDrawdownPercent: numeric("max_drawdown_percent", { precision: 10, scale: 2 }).notNull(),
    trades: text("trades").notNull(),
    signals: text("signals").notNull(),
    equityCurve: text("equity_curve").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("backtest_results_user_id_idx").on(table.userId),
    strategyIdIdx: index("backtest_results_strategy_id_idx").on(table.strategyId),
  })
);

// 手动干预记录表
export const manualInterventions = pgTable(
  "manual_interventions",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    taskId: varchar("task_id", { length: 36 }),
    symbol: varchar("symbol", { length: 50 }),
    params: jsonb("params"),
    success: boolean("success").notNull(),
    result: jsonb("result"),
    error: text("error"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("manual_interventions_user_id_idx").on(table.userId),
    taskIdIdx: index("manual_interventions_task_id_idx").on(table.taskId),
  })
);

// 交易日志表
export const tradingLogs = pgTable(
  "trading_logs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 }).notNull(),
    taskId: varchar("task_id", { length: 36 }),
    level: varchar("level", { length: 20 }).notNull(),
    message: text("message").notNull(),
    category: varchar("category", { length: 50 }),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("trading_logs_user_id_idx").on(table.userId),
    taskIdIdx: index("trading_logs_task_id_idx").on(table.taskId),
    levelIdx: index("trading_logs_level_idx").on(table.level),
    createdAtIdx: index("trading_logs_created_at_idx").on(table.createdAt),
  })
);

// 系统统计表
export const systemStats = pgTable(
  "system_stats",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    totalTasks: integer("total_tasks").default(0).notNull(),
    activeTasks: integer("active_tasks").default(0).notNull(),
    totalSignals: integer("total_signals").default(0).notNull(),
    totalTrades: integer("total_trades").default(0).notNull(),
    totalProfit: numeric("total_profit", { precision: 20, scale: 8 }).default("0").notNull(),
    totalLoss: numeric("total_loss", { precision: 20, scale: 8 }).default("0").notNull(),
    winRate: numeric("win_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index("system_stats_user_id_idx").on(table.userId),
    dateIdx: index("system_stats_date_idx").on(table.date),
    uniqueDateIdx: index("system_stats_user_date_idx").on(table.userId, table.date),
  })
);

// TypeScript types
export type UserConfig = typeof userConfigs.$inferSelect;
export type InsertUserConfig = z.infer<typeof insertUserConfigSchema>;

export type TradeTask = typeof tradeTasks.$inferSelect;
export type InsertTradeTask = z.infer<typeof insertTradeTaskSchema>;

export type SignalExecutionRecord = typeof signalExecutionRecords.$inferSelect;
export type InsertSignalExecutionRecord = z.infer<typeof insertSignalExecutionRecordSchema>;

export type BacktestResult = typeof backtestResults.$inferSelect;
export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;

export type ManualIntervention = typeof manualInterventions.$inferSelect;
export type InsertManualIntervention = z.infer<typeof insertManualInterventionSchema>;

export type TradingLog = typeof tradingLogs.$inferSelect;
export type InsertTradingLog = z.infer<typeof insertTradingLogSchema>;

export type SystemStat = typeof systemStats.$inferSelect;
export type InsertSystemStat = z.infer<typeof insertSystemStatSchema>;

// Zod schemas for validation
export const insertUserConfigSchema = createCoercedInsertSchema(userConfigs).pick({
  userId: true,
  exchangeType: true,
  apiKey: true,
  apiSecret: true,
  testnet: true,
  enableTrading: true,
  metadata: true,
});

export const insertTradeTaskSchema = createCoercedInsertSchema(tradeTasks).pick({
  userId: true,
  name: true,
  strategyId: true,
  strategyName: true,
  strategyParams: true,
  symbols: true,
  timeframes: true,
  riskControl: true,
  status: true,
  metadata: true,
});

export const insertSignalExecutionRecordSchema = createCoercedInsertSchema(signalExecutionRecords).pick({
  taskId: true,
  userId: true,
  symbol: true,
  direction: true,
  signalTime: true,
  signalPrice: true,
  confidence: true,
  reason: true,
  executed: true,
  executionTime: true,
  orderId: true,
  executionPrice: true,
  quantity: true,
  positionValue: true,
  exitTime: true,
  exitPrice: true,
  exitReason: true,
  profit: true,
  profitPercent: true,
  error: true,
  metadata: true,
});

export const insertBacktestResultSchema = createCoercedInsertSchema(backtestResults).pick({
  userId: true,
  strategyId: true,
  strategyName: true,
  strategyParams: true,
  symbol: true,
  timeframe: true,
  startTime: true,
  endTime: true,
  initialBalance: true,
  commissionRate: true,
  slippage: true,
  totalTrades: true,
  winningTrades: true,
  losingTrades: true,
  winRate: true,
  totalProfit: true,
  totalLoss: true,
  netProfit: true,
  profitFactor: true,
  maxDrawdown: true,
  maxDrawdownPercent: true,
  trades: true,
  signals: true,
  equityCurve: true,
  metadata: true,
});

export const insertManualInterventionSchema = createCoercedInsertSchema(manualInterventions).pick({
  userId: true,
  type: true,
  taskId: true,
  symbol: true,
  params: true,
  success: true,
  result: true,
  error: true,
  metadata: true,
});

export const insertTradingLogSchema = createCoercedInsertSchema(tradingLogs).pick({
  userId: true,
  taskId: true,
  level: true,
  message: true,
  category: true,
  data: true,
});

export const insertSystemStatSchema = createCoercedInsertSchema(systemStats).pick({
  userId: true,
  date: true,
  totalTasks: true,
  activeTasks: true,
  totalSignals: true,
  totalTrades: true,
  totalProfit: true,
  totalLoss: true,
  winRate: true,
  metadata: true,
});
