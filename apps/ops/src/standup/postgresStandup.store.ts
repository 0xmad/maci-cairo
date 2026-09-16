import { count, desc, eq } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { type DeployMaciCheckpoint, type MaciNetwork } from "maci-deploy/maci";

import { jobs } from "../jobs/job.schema.js";
import { type Page, type Pagination } from "../utils/pagination.js";

import { maciInstances, standupCheckpoints, type StandupCheckpointRow } from "./standup.schema.js";
import { type MaciInstanceRecord, type MaciListItem, type StandupStore } from "./standup.store.js";

type StandupDatabase = NodePgDatabase<{
  jobs: typeof jobs;
  maciInstances: typeof maciInstances;
  standupCheckpoints: typeof standupCheckpoints;
}>;

const CHECKPOINT_ID = 1;
const CHECKPOINT_FIELDS = ["leanImt", "checker", "enforcer", "assigner", "maci"] as const;

function asCheckpoint(row: StandupCheckpointRow): DeployMaciCheckpoint | undefined {
  const checkpoint: DeployMaciCheckpoint = {};

  CHECKPOINT_FIELDS.forEach((field) => {
    const value = row[field];

    if (value !== null && value.length > 0) {
      checkpoint[field] = value;
    }
  });

  return Object.keys(checkpoint).length === 0 ? undefined : checkpoint;
}

function checkpointRow(checkpoint: DeployMaciCheckpoint): StandupCheckpointRow {
  return {
    id: CHECKPOINT_ID,
    leanImt: checkpoint.leanImt ?? null,
    checker: checkpoint.checker ?? null,
    enforcer: checkpoint.enforcer ?? null,
    assigner: checkpoint.assigner ?? null,
    maci: checkpoint.maci ?? null,
  };
}

function asNetwork(value: string): MaciNetwork {
  if (value === "starknet_local") {
    return "starknet_local";
  }

  if (value === "sepolia") {
    return value;
  }

  throw new Error(`unknown MACI network ${value}`);
}

type MaciInstanceRow = typeof maciInstances.$inferSelect;

function asMaci(row: MaciInstanceRow): MaciInstanceRecord {
  return {
    leanImt: row.leanImt,
    checker: row.checker,
    enforcer: row.enforcer,
    assigner: row.assigner,
    pollClassHash: row.pollClassHash,
    pollFactoryClassHash: row.pollFactoryClassHash,
    maci: row.maci,
    pollFactory: row.pollFactory,
    coordinator: row.coordinator,
    deployer: row.deployer,
    network: asNetwork(row.network),
    circuitProfile: row.circuitProfile,
    policy: row.policy,
    voteBalanceAssigner: row.voteBalanceAssigner,
  };
}

/** Postgres persistence for stand-up checkpoints and recorded MACI instances. */
export class PostgresStandupStore implements StandupStore {
  readonly #db: StandupDatabase;

  constructor(db: StandupDatabase) {
    this.#db = db;
  }

  async succeed(jobId: string, completedAtMs: number, maci: MaciInstanceRecord): Promise<void> {
    await this.#db.transaction(async (tx) => {
      await tx.update(jobs).set({ status: "succeeded", completedAtMs }).where(eq(jobs.id, jobId));
      await tx.insert(maciInstances).values({
        leanImt: maci.leanImt,
        checker: maci.checker,
        enforcer: maci.enforcer,
        assigner: maci.assigner,
        pollClassHash: maci.pollClassHash,
        pollFactoryClassHash: maci.pollFactoryClassHash,
        maci: maci.maci,
        pollFactory: maci.pollFactory,
        coordinator: maci.coordinator,
        deployer: maci.deployer,
        circuitProfile: maci.circuitProfile,
        policy: maci.policy,
        voteBalanceAssigner: maci.voteBalanceAssigner,
        jobId,
        network: maci.network,
        createdAtMs: completedAtMs,
      });
      await tx.delete(standupCheckpoints).where(eq(standupCheckpoints.id, CHECKPOINT_ID));
    });
  }

  async mergeCheckpoint(patch: DeployMaciCheckpoint): Promise<void> {
    const merged = { ...(await this.readCheckpoint()), ...patch };
    const row = checkpointRow(merged);

    await this.#db
      .insert(standupCheckpoints)
      .values(row)
      .onConflictDoUpdate({
        target: standupCheckpoints.id,
        set: {
          leanImt: row.leanImt,
          checker: row.checker,
          enforcer: row.enforcer,
          assigner: row.assigner,
          maci: row.maci,
        },
      });
  }

  async readCheckpoint(): Promise<DeployMaciCheckpoint | undefined> {
    const rows = await this.#db
      .select()
      .from(standupCheckpoints)
      .where(eq(standupCheckpoints.id, CHECKPOINT_ID))
      .limit(1);

    if (rows.length === 0) {
      return undefined;
    }

    return asCheckpoint(rows[0]);
  }

  async clearCheckpoint(): Promise<void> {
    await this.#db.delete(standupCheckpoints).where(eq(standupCheckpoints.id, CHECKPOINT_ID));
  }

  async listMacis(pagination: Pagination): Promise<Page<MaciListItem>> {
    const totals = await this.#db.select({ total: count() }).from(maciInstances);
    const rows = await this.#db
      .select()
      .from(maciInstances)
      .orderBy(desc(maciInstances.id))
      .limit(pagination.pageSize)
      .offset((pagination.page - 1) * pagination.pageSize);

    return {
      items: rows.map((row): MaciListItem => ({
        address: row.maci,
        network: asMaci(row).network,
        createdAtMs: row.createdAtMs,
      })),
      total: totals[0]?.total ?? 0,
    };
  }

  async readMaci(address: string): Promise<MaciInstanceRecord | undefined> {
    const rows = await this.#db.select().from(maciInstances).where(eq(maciInstances.maci, address)).limit(1);

    if (rows.length === 0) {
      return undefined;
    }

    return asMaci(rows[0]);
  }
}
