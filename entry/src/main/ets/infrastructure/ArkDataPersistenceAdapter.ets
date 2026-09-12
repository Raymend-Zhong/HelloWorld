import { relationalStore } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';

import type {
  FamilyState,
  PersistenceAdapter,
} from '../domain/FamilyHabitModule';

const CREATE_STATE_TABLE = `CREATE TABLE IF NOT EXISTS family_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  payload TEXT NOT NULL
)`;

export class ArkDataPersistenceAdapter implements PersistenceAdapter {
  private constructor(private readonly store: relationalStore.RdbStore) {}

  static async open(
    context: common.UIAbilityContext,
    storeName: string = 'family_habit.db',
  ): Promise<ArkDataPersistenceAdapter> {
    const store = await relationalStore.getRdbStore(context, {
      name: storeName,
      securityLevel: relationalStore.SecurityLevel.S2,
    });
    await store.execute(CREATE_STATE_TABLE, 0);
    return new ArkDataPersistenceAdapter(store);
  }

  close(): void {
    this.store.close();
  }

  async load(): Promise<FamilyState | null> {
    const rows = await this.store.querySql(
      'SELECT payload FROM family_state WHERE id = 1',
    );
    try {
      if (!rows.goToFirstRow()) return null;
      const payload = rows.getString(rows.getColumnIndex('payload'));
      return JSON.parse(payload) as FamilyState;
    } finally {
      rows.close();
    }
  }

  async save(state: FamilyState): Promise<void> {
    const transactionId = await this.store.beginTrans();
    try {
      await this.store.execute(
        `INSERT OR REPLACE INTO family_state
          (id, schema_version, revision, payload) VALUES (?, ?, ?, ?)`,
        transactionId,
        [1, state.schemaVersion, state.revision, JSON.stringify(state)],
      );
      await this.store.commit(transactionId);
    } catch (error) {
      await this.store.rollback(transactionId);
      throw error;
    }
  }
}
